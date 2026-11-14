// Which shapes a 3D renderer shows in 3D, and with what parameters — shared by the CSS 3D
// and GPU 3D renderers so both stand up the same shapes. Pure, apart from the service
// handle and the declared-types helper.
import { defineService } from "./service.js";
import { shapeView3dAnchor } from "./shape-solids.js";
import {
	resolveShapeView3d,
	type ShapeTypeView3d,
	type ShapeView3d,
	shapeTypeModes,
} from "./shape-view-3d.js";
import type { BoundingBox, Viewport } from "./types/geometry.js";
import type { RenderMode } from "./types/lod.js";
import type { ShapeRegistry } from "./types/plugin.js";
import type { ShapeData } from "./types/shape.js";
import { worldToScreen } from "./utils/geometry.js";
import { wrapDeg } from "./utils/rotation.js";

/** Each shape type's 3D (`ShapeTypeView3d`), by type. */
export type View3dShapeTypes = Readonly<Record<string, ShapeTypeView3d>>;

/** How many 3D shapes are drawn, and how. */
export interface View3dShapeLimits {
	/** Shapes smaller than this on screen (px, longer side) stay flat. */
	minPx: number;
	/** At most this many shapes are drawn in 3D — the nearest (lowest on screen) win. */
	maxCount: number;
	/** Shapes holding no 3D parameters still lie on the terrain's height where it is
	 *  raised (drawn as a flat `float` of height 0), instead of on the board at 0.
	 *  Default `true`. */
	groundFlat: boolean;
}

export const DEFAULT_VIEW3D_SHAPE_LIMITS: View3dShapeLimits = {
	minPx: 8,
	maxCount: 200,
	groundFlat: true,
};

/** Limits with every field usable (a bad one falls back to the default). Pure. */
export function sanitizeView3dShapeLimits(l: Partial<View3dShapeLimits> = {}): View3dShapeLimits {
	const d = DEFAULT_VIEW3D_SHAPE_LIMITS;
	return {
		minPx:
			typeof l.minPx === "number" && Number.isFinite(l.minPx) && l.minPx >= 0 ? l.minPx : d.minPx,
		maxCount:
			typeof l.maxCount === "number" && Number.isFinite(l.maxCount) && l.maxCount >= 0
				? Math.floor(l.maxCount)
				: d.maxCount,
		groundFlat: typeof l.groundFlat === "boolean" ? l.groundFlat : d.groundFlat,
	};
}

/** What a plugin hands the 3D renderers to draw 3D shapes by (instead of the declared types). */
export interface View3dShapeSource {
	/** The types' 3D to use instead of what the board's types declare. */
	types?(): View3dShapeTypes;
	/** Limits over {@link DEFAULT_VIEW3D_SHAPE_LIMITS}. */
	limits?(): Partial<View3dShapeLimits>;
}

/**
 * A plugin's source for the renderers' 3D shapes (read on every draw, so set up in any
 * order). The key is the CSS 3D renderer's, where it started.
 */
export const view3dShapeSourceService = defineService<View3dShapeSource>(
	"usketch-css3d-renderer:shape-source",
);

/** The parts of the shape registry the declared-types helper reads. */
type View3dTypeRegistry = Pick<ShapeRegistry, "getAll"> & {
	getView3d?(type: string): ShapeTypeView3d | undefined;
	subscribeView3d?(listener: () => void): () => void;
};

/**
 * The 3D the board's types declare (`ShapeDefinition.view3d`, with the host's overrides),
 * rebuilt only when a type registers or an override changes. `dispose` stops listening.
 */
export function declaredView3dShapeTypes(
	shapes: View3dTypeRegistry,
	onChange?: () => void,
): { get(): View3dShapeTypes; dispose(): void } {
	let version = 0;
	const off = shapes.subscribeView3d?.(() => {
		version++;
		onChange?.();
	});
	let key = "";
	let cached: View3dShapeTypes = {};
	return {
		get() {
			const all = shapes.getAll();
			const next = `${all.size}:${version}`;
			if (next === key) return cached;
			const out: Record<string, ShapeTypeView3d> = {};
			for (const [type, def] of all) {
				const view3d = shapes.getView3d ? shapes.getView3d(type) : def.view3d;
				if (view3d) out[type] = view3d;
			}
			key = next;
			cached = out;
			return cached;
		},
		dispose: () => off?.(),
	};
}

/** What a shape holding no 3D parameters is drawn as on raised ground: flat, at its height. */
export const GROUND_FLAT_VIEW3D: ShapeView3d = {
	mode: "float",
	height: 0,
	facing: "camera",
	ground: true,
	shadow: false,
	collision: "none",
};

export interface View3dShapeEntry {
	shape: ShapeData;
	params: ShapeView3d;
}

/**
 * The shapes to draw in 3D now (in z-order). Only while the view is (partly) 3D, never
 * in the global LOD mode, and only shapes whose anchor is on the drawn ground: the board
 * box grown by the 3D view's overscan (a shape farther out would stand in the sky past
 * the ground's end). With `limits.groundFlat` and a `heightAt`, a shape holding no 3D
 * parameters whose centre is on raised ground is drawn too, lying flat at that height
 * ({@link GROUND_FLAT_VIEW3D}). Pure.
 */
export function selectView3dShapes(input: {
	shapes: readonly ShapeData[];
	types: View3dShapeTypes;
	viewport: Viewport;
	viewportBounds: BoundingBox;
	/** Screen px the 3D view shows past the board box. */
	overscanPx: number;
	renderMode: RenderMode;
	amount: number;
	limits: View3dShapeLimits;
	/** The terrain's height (world units) for `limits.groundFlat`; absent = no terrain. */
	heightAt?: (x: number, y: number) => number;
}): View3dShapeEntry[] {
	if (!(input.amount > 0) || input.renderMode === "lod") return [];
	const zoom = input.viewport.zoom;
	if (!(zoom > 0)) return [];
	const pad = input.overscanPx > 0 ? input.overscanPx / zoom : 0;
	const b = input.viewportBounds;
	const x0 = b.x - pad;
	const y0 = b.y - pad;
	const x1 = b.x + b.width + pad;
	const y1 = b.y + b.height + pad;
	const found: (View3dShapeEntry & { screenY: number })[] = [];
	for (const shape of input.shapes) {
		if (!shape || typeof shape.id !== "string") continue;
		// Size and place first: they need no terrain, so a shape too small or off screen never
		// samples `heightAt` (on a wide board that thrashes the terrain's chunk cache every frame).
		if (Math.max(shape.width, shape.height) * zoom < input.limits.minPx) continue;
		const own = resolveShapeView3d(shape, input.types[shape.type]);
		const at = shapeView3dAnchor(shape, own?.mode ?? GROUND_FLAT_VIEW3D.mode);
		if (at.x < x0 || at.x > x1 || at.y < y0 || at.y > y1) continue;
		const params = own ?? groundFlatParams(shape, input);
		if (!params) continue;
		found.push({ shape, params, screenY: worldToScreen(at.x, at.y, input.viewport).y });
	}
	const max = Math.max(0, Math.floor(input.limits.maxCount));
	if (found.length > max) {
		const keep = new Set(
			[...found]
				.sort((a, b) => b.screenY - a.screenY)
				.slice(0, max)
				.map((e) => e.shape.id),
		);
		return found
			.filter((e) => keep.has(e.shape.id))
			.map(({ shape, params }) => ({ shape, params }));
	}
	return found.map(({ shape, params }) => ({ shape, params }));
}

function groundFlatParams(
	shape: ShapeData,
	input: {
		types: View3dShapeTypes;
		limits: View3dShapeLimits;
		heightAt?: (x: number, y: number) => number;
	},
): ShapeView3d | null {
	if (!input.limits.groundFlat || !input.heightAt) return null;
	if (!shapeTypeModes(input.types[shape.type]).includes("float")) return null;
	const at = shapeView3dAnchor(shape, "float");
	const h = input.heightAt(at.x, at.y);
	return Number.isFinite(h) && h > 0 ? GROUND_FLAT_VIEW3D : null;
}

/** `a` turned toward `b` by `t` (0…1) the short way round, degrees. Pure. */
export function lerpAngle(a: number, b: number, t: number): number {
	return a + wrapDeg(b - a) * t;
}

/**
 * The heading (deg, on the flat screen) of a 3D shape: its rotation on screen, turned —
 * for a stood-up shape facing the camera — toward the camera (`-yaw`) as the view rises.
 * Pure.
 */
export function view3dShapeHeading(
	params: Pick<ShapeView3d, "mode" | "facing">,
	flat: number,
	amount: number,
	yaw: number,
): number {
	const t = Math.min(1, Math.max(0, Number.isFinite(amount) ? amount : 0));
	return params.mode === "stand" && params.facing === "camera" ? lerpAngle(flat, -yaw, t) : flat;
}

/**
 * A `box` shape's wall colour: its fill (`style.fill`, else `color`), or a neutral grey
 * when it has none usable. The renderers darken it per wall.
 */
export function view3dShapeWallColor(shape: ShapeData): string {
	const color = (shape as { color?: unknown }).color;
	const fill = shape.style?.fill ?? (typeof color === "string" ? color : undefined);
	if (typeof fill !== "string") return "#9e9e9e";
	const f = fill.trim().toLowerCase();
	if (f === "" || f === "none" || f === "transparent") return "#9e9e9e";
	return fill;
}
