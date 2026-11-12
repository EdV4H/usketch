// The per-shape 3D parameters. They live on the shape under an `x-` extension key, so
// the core ShapeData type is untouched and a board without this plugin just carries
// them along (sync keeps unknown keys). Everything here is pure.
import type { ShapeData } from "@edv4h/usketch-shared";
import type { Shape3dRender } from "./shape-3d-render3d.js";

/** The ShapeData key holding a shape's 3D parameters. */
export const SHAPE_3D_KEY = "x-shape-3d";

/**
 * How a shape stands out of the ground in 3D: `stand` folds it upright about its bottom
 * edge (a sign), `box` lifts it as the top of a block with walls down to the ground (a
 * crate, a building), `float` lifts it flat into the air (a label, a balloon).
 */
export type Shape3dMode = "stand" | "box" | "float";

/** Every mode, in HUD order. */
export const SHAPE_3D_MODES: readonly Shape3dMode[] = ["stand", "box", "float"];

/**
 * Modes a shape type may use when its config names none. `box` is left out: it only
 * suits shapes that fill their box (an ellipse or a pen stroke as a block looks wrong).
 */
export const DEFAULT_TYPE_MODES: readonly Shape3dMode[] = ["stand", "float"];

/** Default `height` (world units; one terrain level is 16) per mode that uses it. */
export const DEFAULT_SHAPE_3D_HEIGHT: Readonly<Record<Shape3dMode, number>> = {
	stand: 0,
	box: 16,
	float: 24,
};

/** `height` is clamped to 0…this (world units). */
export const MAX_SHAPE_3D_HEIGHT = 2000;

/**
 * Which way a stood-up shape faces: `"camera"` turns to face the viewer (a sign, a
 * tree sprite), `"fixed"` stands along its own bottom edge (a fence, a wall).
 */
export type Shape3dFacing = "camera" | "fixed";

/**
 * How a walking character meets the shape: `none` passes through, `solid` is a wall it
 * can't pass (it slides along), `platform` is a block whose top it can stand on (walked
 * up within the step limit, else jumped onto).
 */
export type Shape3dCollision = "none" | "solid" | "platform";

/** Every collision, in HUD order. */
export const SHAPE_3D_COLLISIONS: readonly Shape3dCollision[] = ["none", "solid", "platform"];

/** The collisions each mode can have: a floating shape has none (it can be walked under). */
export const COLLISIONS_BY_MODE: Readonly<Record<Shape3dMode, readonly Shape3dCollision[]>> = {
	stand: ["none", "solid"],
	box: ["none", "solid", "platform"],
	float: ["none"],
};

export interface Shape3dParams {
	mode: Shape3dMode;
	/** `box`: the block's height / `float`: how high it floats (world units). Unused by
	 *  `stand`. Defaults per mode ({@link DEFAULT_SHAPE_3D_HEIGHT}). */
	height: number;
	/** `stand` only. Default `"camera"`. */
	facing: Shape3dFacing;
	/** Stand on the terrain's height (the shared ground-height service). Default `true`. */
	ground: boolean;
	/** Cast a soft shadow on the ground. Default `true`. */
	shadow: boolean;
	/** How a walking character meets it. Default `"none"`. See {@link effectiveCollision}. */
	collision: Shape3dCollision;
}

/** What a shape may hold under {@link SHAPE_3D_KEY} (any field may be missing). */
export type Shape3dInput = Omit<Partial<Shape3dParams>, "mode"> & { mode?: string };

export const DEFAULT_SHAPE_3D_PARAMS: Omit<Shape3dParams, "mode" | "height"> = {
	facing: "camera",
	ground: true,
	shadow: true,
	collision: "none",
};

function isMode(v: unknown): v is Shape3dMode {
	return typeof v === "string" && (SHAPE_3D_MODES as readonly string[]).includes(v);
}

/**
 * Validate raw parameters into complete ones, filling defaults; `null` when there is no
 * usable mode (absent, unknown, or not an object). Unknown fields are dropped.
 */
export function normalizeShape3d(raw: unknown): Shape3dParams | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (!isMode(r.mode)) return null;
	return {
		mode: r.mode,
		height: validHeight(r.height) ?? DEFAULT_SHAPE_3D_HEIGHT[r.mode],
		facing:
			r.facing === "fixed" || r.facing === "camera" ? r.facing : DEFAULT_SHAPE_3D_PARAMS.facing,
		ground: typeof r.ground === "boolean" ? r.ground : DEFAULT_SHAPE_3D_PARAMS.ground,
		shadow: typeof r.shadow === "boolean" ? r.shadow : DEFAULT_SHAPE_3D_PARAMS.shadow,
		collision: (SHAPE_3D_COLLISIONS as readonly unknown[]).includes(r.collision)
			? (r.collision as Shape3dCollision)
			: DEFAULT_SHAPE_3D_PARAMS.collision,
	};
}

/**
 * The collision a shape really has in its mode: as set when the mode allows it, a
 * `platform` stood up is a `solid` wall, anything else the mode can't have is `none`.
 * (Stored as set, so switching back to `box` restores it.) Pure.
 */
export function effectiveCollision(
	params: Pick<Shape3dParams, "mode" | "collision">,
): Shape3dCollision {
	const allowed = COLLISIONS_BY_MODE[params.mode];
	if (allowed.includes(params.collision)) return params.collision;
	return params.collision === "platform" && allowed.includes("solid") ? "solid" : "none";
}

/** A usable `height` (clamped), or `null` when it isn't a finite number. */
function validHeight(v: unknown): number | null {
	if (typeof v !== "number" || !Number.isFinite(v)) return null;
	return Math.min(MAX_SHAPE_3D_HEIGHT, Math.max(0, v));
}

/**
 * The parameters as they are stored on a shape: normalized, but `height` kept only when
 * it was given — so a shape switched between `box` and `float` takes each mode's default
 * height instead of carrying the other's. `null` when there is no usable mode. Pure.
 */
export function storedShape3d(raw: unknown): Shape3dInput | null {
	const params = normalizeShape3d(raw);
	if (!params) return null;
	const height = validHeight((raw as Record<string, unknown>).height);
	const { height: _resolved, ...rest } = params;
	return height === null ? rest : { ...rest, height };
}

// ── Per-type configuration (passed by the host, not declared by shape plugins) ──

export interface Shape3dTypeConfig {
	/** Modes this shape type may use. Default {@link DEFAULT_TYPE_MODES}. `[]` = never 3D. */
	modes?: readonly Shape3dMode[];
	/** Parameters a shape of this type gets when it holds none of its own (e.g. portals
	 *  always stand). A function can decide per shape; `null` = stays flat. */
	default?: Shape3dInput | ((shape: ShapeData) => Shape3dInput | null);
	/** The type's own 3D look, used instead of the generic stand / box / float drawing
	 *  (e.g. a tree as two crossed planes, or a three.js canvas). Returning `null` falls
	 *  back to the generic drawing for that shape. */
	render3d?: Shape3dRender;
}

export type Shape3dTypes = Readonly<Record<string, Shape3dTypeConfig>>;

const ALL_MODES = { modes: SHAPE_3D_MODES };

/**
 * Built-in per-type settings. Shapes that fill their box may also be a `box`; embedded
 * pages and generated UI are heavy live HTML that blurs or stutters under a 3D
 * transform, so they stay flat. Other types get {@link DEFAULT_TYPE_MODES}.
 */
export const DEFAULT_SHAPE_3D_TYPES: Shape3dTypes = {
	rectangle: ALL_MODES,
	"rounded-rect": ALL_MODES,
	sticky: ALL_MODES,
	card: ALL_MODES,
	frame: ALL_MODES,
	image: ALL_MODES,
	embed: { modes: [] },
	openui: { modes: [] },
};

/** `base` overridden per type by `over` (a type's fields merge). Pure. */
export function mergeShape3dTypes(base: Shape3dTypes, over: Shape3dTypes = {}): Shape3dTypes {
	const out: Record<string, Shape3dTypeConfig> = { ...base };
	for (const [type, config] of Object.entries(over)) out[type] = { ...out[type], ...config };
	return out;
}

/** The modes a shape type may use. */
export function availableModes(types: Shape3dTypes, type: string): readonly Shape3dMode[] {
	return types[type]?.modes ?? DEFAULT_TYPE_MODES;
}

/** A shape's own (normalized) parameters, ignoring its type's default. */
export function ownShape3d(shape: ShapeData): Shape3dParams | null {
	return normalizeShape3d(shape[SHAPE_3D_KEY]);
}

/**
 * The 3D parameters a shape renders with: its own, else its type's default — and
 * `null` when the result's mode isn't allowed for the type. Pure.
 */
export function resolveShape3d(shape: ShapeData, types: Shape3dTypes): Shape3dParams | null {
	const config = types[shape.type];
	let params = ownShape3d(shape);
	if (!params && config?.default) {
		const d = typeof config.default === "function" ? config.default(shape) : config.default;
		params = normalizeShape3d(d);
	}
	if (!params) return null;
	return availableModes(types, shape.type).includes(params.mode) ? params : null;
}
