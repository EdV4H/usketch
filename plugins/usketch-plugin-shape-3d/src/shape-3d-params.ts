// The per-shape 3D parameters. They live on the shape under an `x-` extension key, so
// the core ShapeData type is untouched and a board without this plugin just carries
// them along (sync keeps unknown keys). Everything here is pure.
import type { ShapeData } from "@edv4h/usketch-shared";

/** The ShapeData key holding a shape's 3D parameters. */
export const SHAPE_3D_KEY = "x-shape-3d";

/** How a shape stands out of the ground in 3D. */
export type Shape3dMode = "stand";

/** Every mode, in HUD order. */
export const SHAPE_3D_MODES: readonly Shape3dMode[] = ["stand"];

/**
 * Which way a stood-up shape faces: `"camera"` turns to face the viewer (a sign, a
 * tree sprite), `"fixed"` stands along its own bottom edge (a fence, a wall).
 */
export type Shape3dFacing = "camera" | "fixed";

export interface Shape3dParams {
	mode: Shape3dMode;
	/** `stand` only. Default `"camera"`. */
	facing: Shape3dFacing;
	/** Stand on the terrain's height (the shared ground-height service). Default `true`. */
	ground: boolean;
	/** Cast a soft shadow on the ground. Default `true`. */
	shadow: boolean;
}

/** What a shape may hold under {@link SHAPE_3D_KEY} (any field may be missing). */
export type Shape3dInput = Omit<Partial<Shape3dParams>, "mode"> & { mode?: string };

export const DEFAULT_SHAPE_3D_PARAMS: Omit<Shape3dParams, "mode"> = {
	facing: "camera",
	ground: true,
	shadow: true,
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
		facing:
			r.facing === "fixed" || r.facing === "camera" ? r.facing : DEFAULT_SHAPE_3D_PARAMS.facing,
		ground: typeof r.ground === "boolean" ? r.ground : DEFAULT_SHAPE_3D_PARAMS.ground,
		shadow: typeof r.shadow === "boolean" ? r.shadow : DEFAULT_SHAPE_3D_PARAMS.shadow,
	};
}

// ── Per-type configuration (passed by the host, not declared by shape plugins) ──

export interface Shape3dTypeConfig {
	/** Modes this shape type may use. Default: every mode. `[]` = never 3D. */
	modes?: readonly Shape3dMode[];
	/** Parameters a shape of this type gets when it holds none of its own (e.g. portals
	 *  always stand). A function can decide per shape; `null` = stays flat. */
	default?: Shape3dInput | ((shape: ShapeData) => Shape3dInput | null);
}

export type Shape3dTypes = Readonly<Record<string, Shape3dTypeConfig>>;

/**
 * Built-in per-type settings: embedded pages and generated UI are heavy live HTML that
 * blurs or stutters under a 3D transform, so they stay flat.
 */
export const DEFAULT_SHAPE_3D_TYPES: Shape3dTypes = {
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
	return types[type]?.modes ?? SHAPE_3D_MODES;
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
