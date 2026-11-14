// A shape's 3D look (`ShapeData.view3d`): how it stands out of the ground while the board
// is shown in 3D, and how a walking character meets it. A shape without one lies flat.
//
// Until the next major the parameters are written under both `view3d` and the key the
// shape-3d plugin used (`x-shape-3d`), and read from `x-shape-3d` first while a shape
// still has it: a client on an older version only writes that key, so in a mixed room
// it is the newest. Everything here is pure.
import type { ReactElement } from "react";
import type { ShapeData } from "./types/shape.js";
import type { View3dCamera } from "./view-3d.js";

/**
 * How a shape stands out of the ground in 3D: `stand` folds it upright about its bottom
 * edge (a sign), `box` lifts it as the top of a block with walls down to the ground (a
 * crate, a building), `float` lifts it flat into the air (a label, a balloon).
 */
export type ShapeView3dMode = "stand" | "box" | "float";

/** Every mode, in HUD order. */
export const SHAPE_VIEW_3D_MODES: readonly ShapeView3dMode[] = ["stand", "box", "float"];

/**
 * Modes a shape type may use when it declares none. `box` is left out: it only suits
 * shapes that fill their box (an ellipse or a pen stroke as a block looks wrong).
 */
export const DEFAULT_VIEW_3D_TYPE_MODES: readonly ShapeView3dMode[] = ["stand", "float"];

/** Default `height` (world units; one terrain level is 16) per mode that uses it. */
export const DEFAULT_VIEW_3D_HEIGHT: Readonly<Record<ShapeView3dMode, number>> = {
	stand: 0,
	box: 16,
	float: 24,
};

/** `height` is clamped to 0…this (world units). */
export const MAX_VIEW_3D_HEIGHT = 2000;

/**
 * Which way a stood-up shape faces: `"camera"` turns to face the viewer (a sign, a
 * tree sprite), `"fixed"` stands along its own bottom edge (a fence, a wall).
 */
export type ShapeView3dFacing = "camera" | "fixed";

/**
 * How a walking character meets the shape: `none` passes through, `solid` is a wall it
 * can't pass (it slides along), `platform` is a block whose top it can stand on (walked
 * up within the step limit, else jumped onto).
 */
export type ShapeView3dCollision = "none" | "solid" | "platform";

/** Every collision, in HUD order. */
export const SHAPE_VIEW_3D_COLLISIONS: readonly ShapeView3dCollision[] = [
	"none",
	"solid",
	"platform",
];

/** The collisions each mode can have: a floating shape has none (it can be walked under). */
export const VIEW_3D_COLLISIONS_BY_MODE: Readonly<
	Record<ShapeView3dMode, readonly ShapeView3dCollision[]>
> = {
	stand: ["none", "solid"],
	box: ["none", "solid", "platform"],
	float: ["none"],
};

/** A shape's complete 3D parameters. */
export interface ShapeView3d {
	mode: ShapeView3dMode;
	/** `box`: the block's height / `float`: how high it floats (world units). Unused by
	 *  `stand`. Defaults per mode ({@link DEFAULT_VIEW_3D_HEIGHT}). */
	height: number;
	/** `stand` only. Default `"camera"`. */
	facing: ShapeView3dFacing;
	/** Stand on the ground's height (the board's height). Default `true`. */
	ground: boolean;
	/** Cast a soft shadow on the ground. Default `true`. */
	shadow: boolean;
	/** How a walking character meets it. Default `"none"`. See {@link shapeView3dCollision}. */
	collision: ShapeView3dCollision;
}

/** What a shape may hold under `view3d` (any field may be missing). */
export type ShapeView3dInput = Omit<Partial<ShapeView3d>, "mode"> & { mode?: string };

/** Defaults for every field but `mode` and `height`. */
export const DEFAULT_SHAPE_VIEW_3D: Omit<ShapeView3d, "mode" | "height"> = {
	facing: "camera",
	ground: true,
	shadow: true,
	collision: "none",
};

/**
 * The ShapeData key the shape-3d plugin stored the parameters under.
 * @deprecated Written next to `view3d` until the next major, and always read.
 */
export const LEGACY_SHAPE_VIEW_3D_KEY = "x-shape-3d";

function isMode(v: unknown): v is ShapeView3dMode {
	return typeof v === "string" && (SHAPE_VIEW_3D_MODES as readonly string[]).includes(v);
}

/** A usable `height` (clamped), or `null` when it isn't a finite number. */
function validHeight(v: unknown): number | null {
	if (typeof v !== "number" || !Number.isFinite(v)) return null;
	return Math.min(MAX_VIEW_3D_HEIGHT, Math.max(0, v));
}

/**
 * Validate raw parameters into complete ones, filling defaults; `null` when there is no
 * usable mode (absent, unknown, or not an object). Unknown fields are dropped.
 */
export function normalizeShapeView3d(raw: unknown): ShapeView3d | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	if (!isMode(r.mode)) return null;
	return {
		mode: r.mode,
		height: validHeight(r.height) ?? DEFAULT_VIEW_3D_HEIGHT[r.mode],
		facing: r.facing === "fixed" || r.facing === "camera" ? r.facing : DEFAULT_SHAPE_VIEW_3D.facing,
		ground: typeof r.ground === "boolean" ? r.ground : DEFAULT_SHAPE_VIEW_3D.ground,
		shadow: typeof r.shadow === "boolean" ? r.shadow : DEFAULT_SHAPE_VIEW_3D.shadow,
		collision: (SHAPE_VIEW_3D_COLLISIONS as readonly unknown[]).includes(r.collision)
			? (r.collision as ShapeView3dCollision)
			: DEFAULT_SHAPE_VIEW_3D.collision,
	};
}

/**
 * The parameters as they are stored on a shape: normalized, but `height` kept only when
 * it was given — so a shape switched between `box` and `float` takes each mode's default
 * height instead of carrying the other's. `null` when there is no usable mode.
 */
export function storedShapeView3d(raw: unknown): ShapeView3dInput | null {
	const params = normalizeShapeView3d(raw);
	if (!params) return null;
	const height = validHeight((raw as Record<string, unknown>).height);
	const { height: _resolved, ...rest } = params;
	return height === null ? rest : { ...rest, height };
}

/**
 * The collision a shape really has in its mode: as set when the mode allows it, a
 * `platform` stood up is a `solid` wall, anything else the mode can't have is `none`.
 * (Stored as set, so switching back to `box` restores it.)
 */
export function shapeView3dCollision(
	params: Pick<ShapeView3d, "mode" | "collision">,
): ShapeView3dCollision {
	const allowed = VIEW_3D_COLLISIONS_BY_MODE[params.mode];
	if (allowed.includes(params.collision)) return params.collision;
	return params.collision === "platform" && allowed.includes("solid") ? "solid" : "none";
}

/** What a shape holds for its 3D look, as stored (see the module comment for the order). */
export function rawShapeView3d(shape: ShapeData): unknown {
	const legacy = shape[LEGACY_SHAPE_VIEW_3D_KEY];
	return legacy !== undefined && legacy !== null ? legacy : shape.view3d;
}

/** A shape's own 3D parameters (normalized), ignoring its type's default. */
export function readShapeView3d(shape: ShapeData): ShapeView3d | null {
	return normalizeShapeView3d(rawShapeView3d(shape));
}

/**
 * The update that stores `stored` as a shape's 3D parameters (`undefined` clears them):
 * under `view3d` and, until the next major, the older key too.
 */
export function shapeView3dPatch(stored: ShapeView3dInput | undefined): Partial<ShapeData> {
	return { view3d: stored, [LEGACY_SHAPE_VIEW_3D_KEY]: stored };
}

// ── A shape type's 3D (declared by its plugin, overridden by the host) ──

/** What a shape type's own 3D drawing ({@link ShapeTypeView3d.render3d}) gets. */
export interface ShapeView3dRenderContext {
	/** The shape's resolved 3D parameters. */
	params: ShapeView3d;
	/** How far into 3D the view is, 0 (flat) … 1. Draw flat at 0: the board is flat then. */
	amount: number;
	/** Screen px per world unit. */
	zoom: number;
	/** The node's size in screen px (the shape's size × zoom). Its ground is z = 0. */
	width: number;
	height: number;
	/** Degrees to turn by (`rotateZ`, about the node's anchor) to face the camera, already
	 *  scaled by `amount`. 0 when flat. */
	faceCamera: number;
	/** The shape's own drawing, filling the node (as the flat board draws it). */
	content: ReactElement;
	/** The camera as drawn now (pitch / yaw scaled by `amount`), `null` without a 3D view.
	 *  For a canvas (three.js etc.) that matches its own camera to the view. */
	camera(): View3dCamera | null;
	/** Notified on every change of the camera or the transition amount (also once a 3D view
	 *  appears later), without re-rendering React. Returns an unsubscribe. */
	subscribe(listener: () => void): () => void;
}

/**
 * Draws a shape type in 3D. Return `null` to use the generic drawing for this shape's
 * mode (e.g. only handle `stand`).
 */
export type ShapeView3dRender = (
	shape: ShapeData,
	ctx: ShapeView3dRenderContext,
) => ReactElement | null;

/** A shape type's 3D: `ShapeDefinition.view3d`, or a host's `ctx.shapes.configureView3d`. */
export interface ShapeTypeView3d {
	/** Modes this shape type may use. Default {@link DEFAULT_VIEW_3D_TYPE_MODES}. `[]` = never 3D. */
	modes?: readonly ShapeView3dMode[];
	/** Parameters a shape of this type gets when it holds none of its own (e.g. portals
	 *  always stand). A function can decide per shape; `null` = stays flat. */
	default?: ShapeView3dInput | ((shape: ShapeData) => ShapeView3dInput | null);
	/** The type's own 3D look, used instead of the generic stand / box / float drawing
	 *  (e.g. a tree as two crossed planes, or a three.js canvas). Returning `null` falls
	 *  back to the generic drawing for that shape. */
	render3d?: ShapeView3dRender;
}

/** The modes a shape type may use. */
export function shapeTypeModes(config: ShapeTypeView3d | undefined): readonly ShapeView3dMode[] {
	return config?.modes ?? DEFAULT_VIEW_3D_TYPE_MODES;
}

/**
 * The 3D parameters a shape renders with: its own, else its type's default — and `null`
 * when the result's mode isn't allowed for the type.
 */
export function resolveShapeView3d(
	shape: ShapeData,
	config: ShapeTypeView3d | undefined,
): ShapeView3d | null {
	let params = readShapeView3d(shape);
	if (!params && config?.default) {
		const d = typeof config.default === "function" ? config.default(shape) : config.default;
		params = normalizeShapeView3d(d);
	}
	if (!params) return null;
	return shapeTypeModes(config).includes(params.mode) ? params : null;
}
