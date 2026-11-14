// The renderer's 3D shapes: shapes with 3D parameters (`ShapeData.view3d`, or their type's
// default) stand out of the ground while the board is shown in 3D, and shapes lying on
// raised terrain are lifted onto it. The flat DOM layer skips the same shapes through the
// board's shape claims.
//
// Which modes a type may use comes from the type itself (`ShapeDefinition.view3d` with the
// host's `ctx.shapes.configureView3d`). A plugin can hand the renderer its own table and
// limits instead through `css3dShapeSourceService` (the shape-3d plugin does, for its
// older options, until the next major).
import { VIEWPORT_OVERSCAN_EVENT } from "@edv4h/usketch-dom-renderer";
import {
	boardHeight,
	createView3dTracker,
	defineService,
	type Layer,
	type PluginContext,
	type ShapeTypeView3d,
	shapeClaims,
	type View3dOcclusionApi,
	view3dService,
} from "@edv4h/usketch-shared";
import {
	type Css3dCameraSource,
	type Css3dChangeSource,
	Css3dShapesLayer,
	SHAPE_3D_LAYER_ID,
} from "./shapes-layer.js";
import {
	type Css3dShapeLimits,
	type Css3dShapeTypes,
	DEFAULT_CSS3D_SHAPE_LIMITS,
} from "./shapes-layout.js";

/** What a plugin hands the renderer to draw 3D shapes by (see the module comment). */
export interface Css3dShapeSource {
	/** The types' 3D to use instead of what the board's types declare. */
	types?(): Css3dShapeTypes;
	/** Limits over {@link DEFAULT_CSS3D_SHAPE_LIMITS}. */
	limits?(): Partial<Css3dShapeLimits>;
}

/** A plugin's source for the renderer's 3D shapes (read on every draw, so set up in any order). */
export const css3dShapeSourceService = defineService<Css3dShapeSource>(
	"usketch-css3d-renderer:shape-source",
);

let nextClaimSource = 0;

/** Limits with every field usable (a bad one falls back to the default). Pure. */
export function sanitizeCss3dShapeLimits(l: Partial<Css3dShapeLimits> = {}): Css3dShapeLimits {
	const d = DEFAULT_CSS3D_SHAPE_LIMITS;
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

export interface Css3dShapesOptions {
	/** What the ground hides (the renderer's), read on every draw. */
	occlusion?: () => View3dOcclusionApi | null;
}

/**
 * Register the 3D shape layer on `ctx` (the CSS 3D renderer does it on setup). Returns its
 * teardown.
 */
export function setupCss3dShapes(ctx: PluginContext, options: Css3dShapesOptions = {}): () => void {
	const tracker = createView3dTracker(ctx.services, ctx.events);
	const claims = shapeClaims(ctx.services);
	const claimSource = `usketch-css3d-renderer:shapes#${nextClaimSource++}`;
	const height = ctx.height ?? boardHeight(ctx.services);
	const heightAt = (x: number, y: number) => height.groundAt(x, y);

	// The types' own 3D, rebuilt when a type registers or the host overrides one.
	let overrideVersion = 0;
	const offOverrides = ctx.shapes.subscribeView3d?.(() => {
		overrideVersion++;
		ctx.events.emit("layers:changed", {});
	});
	let declaredKey = "";
	let declared: Css3dShapeTypes = {};
	const declaredTypes = (): Css3dShapeTypes => {
		const all = ctx.shapes.getAll();
		const key = `${all.size}:${overrideVersion}`;
		if (key === declaredKey) return declared;
		const out: Record<string, ShapeTypeView3d> = {};
		for (const [type, def] of all) {
			const view3d = ctx.shapes.getView3d ? ctx.shapes.getView3d(type) : def.view3d;
			if (view3d) out[type] = view3d;
		}
		declaredKey = key;
		declared = out;
		return declared;
	};

	let overscanPx = 0;
	const offOverscan = ctx.events.on<{ px: number }>(VIEWPORT_OVERSCAN_EVENT, ({ px }) => {
		const next = Number.isFinite(px) && px > 0 ? px : 0;
		if (next === overscanPx) return;
		overscanPx = next;
		ctx.events.emit("layers:changed", {});
	});

	const onDrawn = (ids: ReadonlySet<string>): void => claims.claim(claimSource, ids);
	const camera: Css3dCameraSource = {
		get: () => view3dService.get(ctx.services)?.camera() ?? null,
		subscribe: (listener) => tracker.subscribeCamera(listener),
	};

	// One subscription to the occlusion's changes for every mounted layer.
	let occlusionVersion = 0;
	const occlusionChanges: Css3dChangeSource = {
		get: () => occlusionVersion,
		subscribe(listener) {
			const off = options.occlusion?.()?.subscribe(() => {
				occlusionVersion++;
				listener();
			});
			return () => off?.();
		},
	};

	const layer: Layer = {
		id: SHAPE_3D_LAYER_ID,
		view3d: "depth",
		// Just above the flat DOM shapes (50); a fixed layer placed in screen px.
		order: 51,
		avoidCollision: true,
		fixed: true,
		render: (rc) => {
			const source = css3dShapeSourceService.get(ctx.services);
			return (
				<Css3dShapesLayer
					rc={rc}
					shapes={ctx.shapes}
					tracker={tracker}
					types={source?.types?.() ?? declaredTypes()}
					limits={sanitizeCss3dShapeLimits(source?.limits?.())}
					overscanPx={overscanPx}
					heightAt={heightAt}
					onDrawn={onDrawn}
					camera={camera}
					occlusion={options.occlusion?.() ?? null}
					occlusionChanges={occlusionChanges}
				/>
			);
		},
	};
	ctx.layers.register(layer);

	return () => {
		// Another registration under the same id (an older shape-3d plugin) stays.
		if (ctx.layers.getLayers().some((l) => l === layer)) ctx.layers.unregister(SHAPE_3D_LAYER_ID);
		claims.claim(claimSource, []);
		offOverrides?.();
		offOverscan();
		tracker.dispose();
	};
}
