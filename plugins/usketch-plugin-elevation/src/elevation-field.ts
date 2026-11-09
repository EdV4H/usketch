// The elevation field's data: one `elevation-field` shape per board holds the settings
// (sample spacing, the infinite terrain's seed + frozen generator parameters, water
// level), and `elevation-chunk` shapes hold what the brush added on top, chunk by chunk.
// Both are data-only substrates like the map's tilemap: locked, never hit, drawing
// nothing themselves. Splitting the edits into chunks keeps a sync small: a shape is
// synced as one whole value, so one big shape would resend everything on every edit.
import type { ShapeData } from "@edv4h/usketch-shared";

export const FIELD_TYPE = "elevation-field";
export const CHUNK_TYPE = "elevation-chunk";

/** World units between two samples of a new field. */
export const DEFAULT_SPACING = 16;
/** Samples along a chunk's side. */
export const DEFAULT_CHUNK = 32;
/** Highest ground (world units); heights are kept in `0 … MAX_HEIGHT`. */
export const MAX_HEIGHT = 4095.75;
/** Stored deltas are in quarter units. */
export const DELTA_SCALE = 4;

/**
 * The id every client gives the field it creates. Fixed, so two clients turning the
 * terrain on at once write the same shape (one field) instead of two fields whose
 * chunk ids (`elev:<field>:…`) differ — the edits on the field that doesn't win would
 * otherwise be lost.
 */
export const ELEVATION_FIELD_ID = "elevation-field";

/** Parameters of the infinite terrain, frozen on the field when it is created. */
export interface ElevationGenParams {
	/** Generator version. */
	v: 1;
	/** Height of the highest peaks, roughly (world units). */
	relief: number;
	/** Size of a mountain (world units): larger is gentler. */
	scale: number;
	/** How much each finer octave adds, `0 … 1` (fbm persistence). */
	roughness: number;
	/** How much ridged noise sharpens the high ground, `0 … 1`. */
	ridges: number;
	/** Octaves layered, `1 … 8`. */
	octaves: number;
}

export const DEFAULT_GEN: ElevationGenParams = {
	v: 1,
	relief: 320,
	scale: 2048,
	roughness: 0.5,
	ridges: 0.3,
	octaves: 5,
};

/** Water level of a new infinite terrain, as a fraction of its `relief`. */
export const DEFAULT_WATER_RATIO = 0.15;

export interface ElevationFieldShape extends ShapeData {
	type: typeof FIELD_TYPE;
	spacing: number;
	chunk: number;
	/** Encoding version of the chunks. */
	version: 1;
	/** Seed of the infinite terrain (an integer). Absent = a flat board. */
	seed?: number;
	gen?: ElevationGenParams;
	/** Ground below this height is drawn as water. Absent = no water. */
	waterLevel?: number;
}

export interface ElevationChunkShape extends ShapeData {
	type: typeof CHUNK_TYPE;
	/** Id of the field it belongs to. */
	field: string;
	cx: number;
	cy: number;
	/** `chunk²` Int16 deltas (quarter units, row-major, little-endian), base64. */
	data: string;
}

/** A field's settings with every value checked (see {@link normalizeField}). */
export interface ElevationFieldConfig {
	id: string;
	spacing: number;
	chunk: number;
	/** `null` = no generated terrain (the ground is flat under the edits). */
	seed: number | null;
	gen: ElevationGenParams;
	waterLevel: number | null;
}

export function isElevationField(shape: ShapeData): shape is ElevationFieldShape {
	return shape.type === FIELD_TYPE;
}

export function isElevationChunk(shape: ShapeData): shape is ElevationChunkShape {
	return shape.type === CHUNK_TYPE;
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number, lo: number, hi: number) =>
	finite(v) ? clamp(v, lo, hi) : fallback;

/** Generator parameters with junk replaced by the defaults and values kept in range. Pure. */
export function normalizeGen(raw: unknown): ElevationGenParams {
	const g = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<string, unknown>>;
	return {
		v: 1,
		relief: num(g.relief, DEFAULT_GEN.relief, 0, MAX_HEIGHT),
		scale: num(g.scale, DEFAULT_GEN.scale, 64, 65536),
		roughness: num(g.roughness, DEFAULT_GEN.roughness, 0, 1),
		ridges: num(g.ridges, DEFAULT_GEN.ridges, 0, 1),
		octaves: Math.round(num(g.octaves, DEFAULT_GEN.octaves, 1, 8)),
	};
}

const configCache = new WeakMap<ElevationFieldShape, ElevationFieldConfig>();

/**
 * A field's settings, checked: synced data could carry anything. A spacing / chunk out
 * of range falls back to the default, a non-integer seed means no generated terrain.
 * The same object for the same shape object. Pure.
 */
export function normalizeField(shape: ElevationFieldShape): ElevationFieldConfig {
	const hit = configCache.get(shape);
	if (hit) return hit;
	const spacing =
		finite(shape.spacing) && shape.spacing >= 1 && shape.spacing <= 1024
			? shape.spacing
			: DEFAULT_SPACING;
	const chunk =
		Number.isInteger(shape.chunk) && shape.chunk >= 4 && shape.chunk <= 256
			? shape.chunk
			: DEFAULT_CHUNK;
	const seed = Number.isInteger(shape.seed) ? (shape.seed as number) : null;
	const config: ElevationFieldConfig = {
		id: shape.id,
		spacing,
		chunk,
		seed,
		gen: normalizeGen(shape.gen),
		waterLevel: finite(shape.waterLevel) ? clamp(shape.waterLevel, 0, MAX_HEIGHT) : null,
	};
	configCache.set(shape, config);
	return config;
}

/** The deterministic id of a field's chunk: two clients editing a new spot write the same key. */
export function chunkShapeId(fieldId: string, cx: number, cy: number): string {
	return `elev:${fieldId}:${cx}:${cy}`;
}

/** `"cx,cy"`. */
export function chunkKey(cx: number, cy: number): string {
	return `${cx},${cy}`;
}

const SUBSTRATE_STYLE = { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 };

/** A new field shape (no generated terrain unless `seed` is given). */
export function makeFieldShape(
	id: string,
	opts: {
		spacing?: number;
		chunk?: number;
		seed?: number;
		gen?: ElevationGenParams;
		waterLevel?: number;
	} = {},
): ElevationFieldShape {
	return {
		id,
		type: FIELD_TYPE,
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		style: { ...SUBSTRATE_STYLE },
		locked: true,
		spacing: opts.spacing ?? DEFAULT_SPACING,
		chunk: opts.chunk ?? DEFAULT_CHUNK,
		version: 1,
		...(opts.seed !== undefined ? { seed: opts.seed } : {}),
		...(opts.gen ? { gen: opts.gen } : {}),
		...(opts.waterLevel !== undefined ? { waterLevel: opts.waterLevel } : {}),
	};
}

/** A chunk shape covering its chunk's world rect. */
export function makeChunkShape(
	field: ElevationFieldConfig,
	cx: number,
	cy: number,
	data: string,
): ElevationChunkShape {
	const size = field.chunk * field.spacing;
	return {
		id: chunkShapeId(field.id, cx, cy),
		type: CHUNK_TYPE,
		x: cx * size,
		y: cy * size,
		width: size,
		height: size,
		style: { ...SUBSTRATE_STYLE },
		locked: true,
		field: field.id,
		cx,
		cy,
		data,
	};
}
