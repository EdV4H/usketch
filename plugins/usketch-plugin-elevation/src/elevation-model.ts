// Reading the board's elevation: the field's settings + its decoded chunks, cached so
// the same object comes back for as long as none of those shapes changes (a walking
// character replaces the shapes map every frame and samples the ground several times a
// frame), and a sampler over it: generated height + the brush's delta, per sample and
// between samples.
import type { BoardStore } from "@edv4h/usketch-shared";
import { decodeChunk } from "./elevation-codec.js";
import {
	chunkKey,
	DELTA_SCALE,
	type ElevationChunkShape,
	type ElevationFieldConfig,
	type ElevationFieldShape,
	isElevationChunk,
	isElevationField,
	MAX_HEIGHT,
	normalizeField,
} from "./elevation-field.js";
import { baseHeight } from "./elevation-noise.js";

/** The board's elevation as read from its shapes. */
export interface ElevationModel {
	field: ElevationFieldConfig;
	/** Decoded deltas by `chunkKey(cx, cy)` (quarter units). */
	chunks: ReadonlyMap<string, Int16Array>;
}

/** The field the board uses: the lowest id, so every synced client picks the same one. */
export function boardField(shapes: Iterable<unknown>): ElevationFieldShape | null {
	let best: ElevationFieldShape | null = null;
	for (const s of shapes as Iterable<Parameters<typeof isElevationField>[0]>) {
		if (isElevationField(s) && (best === null || s.id < best.id)) best = s;
	}
	return best;
}

const decoded = new WeakMap<ElevationChunkShape, { length: number; values: Int16Array | null }>();

function decodeShape(shape: ElevationChunkShape, length: number): Int16Array | null {
	const hit = decoded.get(shape);
	if (hit && hit.length === length) return hit.values;
	const values = decodeChunk(shape.data, length);
	decoded.set(shape, { length, values });
	return values;
}

interface CacheEntry {
	shapes: ReadonlyMap<string, unknown>;
	model: ElevationModel | null;
	/** The shapes the model was built from, to keep it when only other shapes change. */
	fieldShape: ElevationFieldShape | null;
	chunkShapes: ElevationChunkShape[];
}
const modelCache = new WeakMap<BoardStore, CacheEntry>();

/**
 * The board's elevation, or `null` when it has no field. The same object while the
 * field and its chunk shapes stay the same objects (shapes are replaced, never mutated,
 * on an update). Chunks of other fields, with a bad position or undecodable data are
 * skipped.
 */
export function boardElevation(store: BoardStore): ElevationModel | null {
	const shapes = store.getShapes();
	const hit = modelCache.get(store);
	if (hit && hit.shapes === shapes) return hit.model;
	const fieldShape = boardField(shapes.values());
	const chunkShapes: ElevationChunkShape[] = [];
	if (fieldShape) {
		for (const s of shapes.values()) {
			if (isElevationChunk(s) && s.field === fieldShape.id) chunkShapes.push(s);
		}
		chunkShapes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	}
	const same =
		hit &&
		hit.fieldShape === fieldShape &&
		hit.chunkShapes.length === chunkShapes.length &&
		hit.chunkShapes.every((c, i) => c === chunkShapes[i]);
	let model = same ? hit.model : null;
	if (!same && fieldShape) {
		const field = normalizeField(fieldShape);
		const length = field.chunk * field.chunk;
		const chunks = new Map<string, Int16Array>();
		for (const c of chunkShapes) {
			if (!Number.isInteger(c.cx) || !Number.isInteger(c.cy)) continue;
			const values = decodeShape(c, length);
			if (values) chunks.set(chunkKey(c.cx, c.cy), values);
		}
		model = { field, chunks };
	}
	modelCache.set(store, { shapes, model, fieldShape, chunkShapes });
	return model;
}

// ── Generated heights, cached per chunk ──

/** Generated chunks kept per terrain (seed + parameters), least recently used dropped. */
export const DEFAULT_BASE_CACHE = 512;

interface BaseCache {
	limit: number;
	chunks: Map<string, Float32Array>;
}
const baseCaches = new Map<string, BaseCache>();

function terrainKey(field: ElevationFieldConfig): string {
	const g = field.gen;
	return `${field.seed}|${field.spacing}|${field.chunk}|${g.v}|${g.relief}|${g.scale}|${g.roughness}|${g.ridges}|${g.octaves}`;
}

/** Change how many generated chunks are kept per terrain (the host option). */
export function setBaseCacheLimit(limit: number): void {
	const n = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : DEFAULT_BASE_CACHE;
	for (const cache of baseCaches.values()) cache.limit = n;
	baseCacheLimit = n;
}
let baseCacheLimit = DEFAULT_BASE_CACHE;

function baseCacheFor(field: ElevationFieldConfig): BaseCache {
	const key = terrainKey(field);
	let cache = baseCaches.get(key);
	if (!cache) {
		// Only the terrains in use matter: one at a time, normally. Drop the others.
		baseCaches.clear();
		cache = { limit: baseCacheLimit, chunks: new Map() };
		baseCaches.set(key, cache);
	}
	return cache;
}

/**
 * The generated heights of one chunk at a level of detail: `chunk²` values, sampled
 * every `2^level` samples (level 0 = every sample). A coarse level is computed on its
 * own points, never from finer chunks, so zoomed-out drawing stays cheap.
 */
function baseChunk(
	field: ElevationFieldConfig,
	level: number,
	cx: number,
	cy: number,
): Float32Array {
	const cache = baseCacheFor(field);
	const key = `${level}:${cx},${cy}`;
	const hit = cache.chunks.get(key);
	if (hit) {
		cache.chunks.delete(key);
		cache.chunks.set(key, hit);
		return hit;
	}
	const n = field.chunk;
	const step = 2 ** level;
	const out = new Float32Array(n * n);
	const seed = field.seed ?? 0;
	for (let lj = 0; lj < n; lj++) {
		const j = (cy * n + lj) * step;
		for (let li = 0; li < n; li++) {
			const i = (cx * n + li) * step;
			out[lj * n + li] = baseHeight(seed, field.gen, i * field.spacing, j * field.spacing);
		}
	}
	cache.chunks.set(key, out);
	while (cache.chunks.size > cache.limit) {
		const oldest = cache.chunks.keys().next().value;
		if (oldest === undefined) break;
		cache.chunks.delete(oldest);
	}
	return out;
}

/** Number of generated chunks cached now (for tests / the HUD). */
export function baseCacheSize(): number {
	let n = 0;
	for (const c of baseCaches.values()) n += c.chunks.size;
	return n;
}

// ── Sampling ──

export interface ElevationSampler {
	readonly field: ElevationFieldConfig;
	/**
	 * Height (world units) at sample `(i, j)`. With `level`, `i` and `j` must be
	 * multiples of `2^level`: the generated part is then read from that level's cache.
	 */
	sample(i: number, j: number, level?: number): number;
	/** Height between samples (bilinear), world units. */
	heightAt(x: number, y: number): number;
}

const samplers = new WeakMap<ElevationModel, ElevationSampler>();

const floorDiv = (a: number, b: number) => Math.floor(a / b);

/** A sampler over a model (one per model object). */
export function elevationSampler(model: ElevationModel): ElevationSampler {
	const hit = samplers.get(model);
	if (hit) return hit;
	const { field, chunks } = model;
	const n = field.chunk;
	const seeded = field.seed !== null;
	const delta = (i: number, j: number): number => {
		const cx = floorDiv(i, n);
		const cy = floorDiv(j, n);
		const values = chunks.get(chunkKey(cx, cy));
		if (!values) return 0;
		return values[(j - cy * n) * n + (i - cx * n)] / DELTA_SCALE;
	};
	const base = (i: number, j: number, level: number): number => {
		if (!seeded) return 0;
		const ci = i / 2 ** level;
		const cj = j / 2 ** level;
		const cx = floorDiv(ci, n);
		const cy = floorDiv(cj, n);
		return baseChunk(field, level, cx, cy)[(cj - cy * n) * n + (ci - cx * n)];
	};
	const sample = (i: number, j: number, level = 0): number => {
		const h = base(i, j, level) + delta(i, j);
		return h < 0 ? 0 : h > MAX_HEIGHT ? MAX_HEIGHT : h;
	};
	const sampler: ElevationSampler = {
		field,
		sample,
		heightAt(x, y) {
			const fx = x / field.spacing;
			const fy = y / field.spacing;
			if (!Number.isFinite(fx) || !Number.isFinite(fy)) return 0;
			const i = Math.floor(fx);
			const j = Math.floor(fy);
			const tx = fx - i;
			const ty = fy - j;
			const a = sample(i, j) + (sample(i + 1, j) - sample(i, j)) * tx;
			const b = sample(i, j + 1) + (sample(i + 1, j + 1) - sample(i, j + 1)) * tx;
			return a + (b - a) * ty;
		},
	};
	samplers.set(model, sampler);
	return sampler;
}

/** Ground height (world units) at a world point on the board; 0 without a field. */
export function elevationHeightAt(store: BoardStore, x: number, y: number): number {
	const model = boardElevation(store);
	return model ? elevationSampler(model).heightAt(x, y) : 0;
}
