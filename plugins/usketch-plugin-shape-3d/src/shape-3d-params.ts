// The per-shape 3D parameters. They are the core's `ShapeData.view3d` now (see
// `@edv4h/usketch-shared`'s shape-view-3d); this module keeps the plugin's own names for
// them until the next major, and the per-type table for shape types that don't declare
// their 3D yet. Everything here is pure.
import {
	DEFAULT_SHAPE_VIEW_3D,
	DEFAULT_VIEW_3D_HEIGHT,
	DEFAULT_VIEW_3D_TYPE_MODES,
	LEGACY_SHAPE_VIEW_3D_KEY,
	MAX_VIEW_3D_HEIGHT,
	normalizeShapeView3d,
	readShapeView3d,
	resolveShapeView3d,
	SHAPE_VIEW_3D_COLLISIONS,
	SHAPE_VIEW_3D_MODES,
	type ShapeData,
	type ShapeTypeView3d,
	type ShapeView3d,
	type ShapeView3dCollision,
	type ShapeView3dFacing,
	type ShapeView3dInput,
	type ShapeView3dMode,
	shapeTypeModes,
	shapeView3dCollision,
	storedShapeView3d,
	VIEW_3D_COLLISIONS_BY_MODE,
} from "@edv4h/usketch-shared";

/**
 * The older ShapeData key of a shape's 3D parameters (written next to `view3d`).
 * @deprecated Use `ShapeData.view3d` (`readShapeView3d` reads both).
 */
export const SHAPE_3D_KEY = LEGACY_SHAPE_VIEW_3D_KEY;

/** How a shape stands out of the ground in 3D (= `ShapeView3dMode`). */
export type Shape3dMode = ShapeView3dMode;
/** Every mode, in HUD order. */
export const SHAPE_3D_MODES = SHAPE_VIEW_3D_MODES;
/** Modes a shape type may use when it declares none (= `DEFAULT_VIEW_3D_TYPE_MODES`). */
export const DEFAULT_TYPE_MODES = DEFAULT_VIEW_3D_TYPE_MODES;
/** Default `height` per mode (= `DEFAULT_VIEW_3D_HEIGHT`). */
export const DEFAULT_SHAPE_3D_HEIGHT = DEFAULT_VIEW_3D_HEIGHT;
/** `height` is clamped to 0…this (world units). */
export const MAX_SHAPE_3D_HEIGHT = MAX_VIEW_3D_HEIGHT;
/** Which way a stood-up shape faces (= `ShapeView3dFacing`). */
export type Shape3dFacing = ShapeView3dFacing;
/** How a walking character meets the shape (= `ShapeView3dCollision`). */
export type Shape3dCollision = ShapeView3dCollision;
/** Every collision, in HUD order. */
export const SHAPE_3D_COLLISIONS = SHAPE_VIEW_3D_COLLISIONS;
/** The collisions each mode can have. */
export const COLLISIONS_BY_MODE = VIEW_3D_COLLISIONS_BY_MODE;
/** A shape's complete 3D parameters (= `ShapeView3d`). */
export type Shape3dParams = ShapeView3d;
/** What a shape may hold for its 3D parameters (= `ShapeView3dInput`). */
export type Shape3dInput = ShapeView3dInput;
/** Defaults for every field but `mode` and `height`. */
export const DEFAULT_SHAPE_3D_PARAMS = DEFAULT_SHAPE_VIEW_3D;
/** Validate raw parameters into complete ones (= `normalizeShapeView3d`). */
export const normalizeShape3d = normalizeShapeView3d;
/** The collision a shape really has in its mode (= `shapeView3dCollision`). */
export const effectiveCollision = shapeView3dCollision;
/** The parameters as they are stored on a shape (= `storedShapeView3d`). */
export const storedShape3d = storedShapeView3d;

// ── Per-type configuration ──
// A shape type declares its 3D (`ShapeDefinition.view3d`) and a host overrides it
// (`ctx.shapes.configureView3d`). The plugin's own table below, its `types` option and
// `registerType` stay until the next major for types that don't declare it yet.

/** A shape type's 3D (= `ShapeTypeView3d`). */
export type Shape3dTypeConfig = ShapeTypeView3d;

export type Shape3dTypes = Readonly<Record<string, Shape3dTypeConfig>>;

const ALL_MODES = { modes: SHAPE_3D_MODES };

/**
 * Built-in per-type settings, for shape plugins that don't declare their 3D yet. Shapes
 * that fill their box may also be a `box`; embedded pages and generated UI are heavy live
 * HTML that blurs or stutters under a 3D transform, so they stay flat. Other types get
 * {@link DEFAULT_TYPE_MODES}.
 * @deprecated Shape types declare it (`ShapeDefinition.view3d`); removed at the next major.
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
	return shapeTypeModes(types[type]);
}

/** A shape's own (normalized) parameters, ignoring its type's default (= `readShapeView3d`). */
export function ownShape3d(shape: ShapeData): Shape3dParams | null {
	return readShapeView3d(shape);
}

/**
 * The 3D parameters a shape renders with: its own, else its type's default — and
 * `null` when the result's mode isn't allowed for the type. Pure.
 */
export function resolveShape3d(shape: ShapeData, types: Shape3dTypes): Shape3dParams | null {
	return resolveShapeView3d(shape, types[shape.type]);
}
