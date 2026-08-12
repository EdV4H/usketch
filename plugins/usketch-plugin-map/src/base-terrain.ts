// Deterministic, infinite base terrain — a pure function of (seed, world cell).
// Because every cell is defined for any integer coord, the map can be panned
// forever (no stored data for unedited space) AND autotiling never sees an
// "unset" neighbour at a chunk boundary (there are no boundaries in the field).
import { type Cells, cellKey } from "./autotile.js";
import { elevationToTerrain } from "./generators/index.js";
import { fbm } from "./generators/noise.js";
import type { TerrainKey } from "./terrain.js";

/**
 * Parameters that fully pin the infinite base terrain's appearance. Recorded on
 * the tilemap shape (see `TileMapShapeData.baseGen`) so a board's world is FROZEN
 * at creation: tuning these defaults later — or swapping the algorithm — will not
 * silently mutate existing boards, because each carries the exact inputs it was
 * generated with. `version` selects the generation *algorithm* implementation
 * (kept around per version for backward-compat); the rest are its tunable inputs.
 *
 * - `scale`   base frequency of the elevation field (smaller ⇒ larger continents)
 * - `seaLevel` fraction of the normalised range below which is water
 * - `gMin/gMax` fixed global contrast window: measured `fbm` output is ~[-0.4, 0.4]
 *   centred near 0, so this window stretches its bulk to [0,1], giving `seaLevel`
 *   a stable meaning AND keeping bands continuous across the whole infinite plane
 *   (a box-local stretch would seam at chunk borders).
 */
export interface BaseGenParams {
	version: number;
	scale: number;
	seaLevel: number;
	gMin: number;
	gMax: number;
}

/** Current generation-algorithm version. Bump when the algorithm changes shape. */
export const BASE_GEN_VERSION = 1;

/** The v1 parameter set — FROZEN. Never edit these values; add a new version. */
const V1_GEN: BaseGenParams = {
	version: 1,
	scale: 0.05,
	seaLevel: 0.42,
	gMin: -0.25,
	gMax: 0.25,
};

/**
 * Params stamped onto NEW boards. Points at the current recommended version and
 * may advance later; a shape's own recorded `baseGen` always wins over this, so
 * advancing the default never touches an existing board.
 */
export const DEFAULT_BASE_GEN: BaseGenParams = V1_GEN;

/** Generation versions this build knows how to render. */
const SUPPORTED_VERSIONS = new Set([1]);

/**
 * Resolve a shape's (possibly `undefined`) `baseGen` to concrete params. A missing
 * value means the shape predates versioning ⇒ it is v1 by definition. `baseGen` is
 * untrusted synced/persisted data, so it is also **validated**: corrupted params
 * (NaN/Infinity, `gMin >= gMax`, `seaLevel`/`scale` out of range) or an
 * unsupported `version` fall back to the FROZEN v1 params rather than producing a
 * NaN-normalised, all-"snow" base across the whole infinite plane.
 */
export function resolveBaseGen(gen: BaseGenParams | undefined): BaseGenParams {
	if (!gen) return V1_GEN;
	const { version, scale, seaLevel, gMin, gMax } = gen;
	const valid =
		SUPPORTED_VERSIONS.has(version) &&
		Number.isFinite(scale) &&
		scale > 0 &&
		Number.isFinite(seaLevel) &&
		seaLevel >= 0 &&
		seaLevel <= 1 &&
		Number.isFinite(gMin) &&
		Number.isFinite(gMax) &&
		gMin < gMax;
	return valid ? gen : V1_GEN;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── Per-chunk cache ──
// `baseTerrainAt` is called per visible cell every frame; caching a chunk's
// terrains once and evicting far chunks (LRU) keeps it cheap while panning.
const CHUNK = 16;
const MAX_CHUNKS = 1024;
const cache = new Map<string, TerrainKey[]>();

/** Compact signature so chunks generated with different params never collide. */
const genSig = (g: BaseGenParams): string =>
	`${g.version}|${g.scale}|${g.seaLevel}|${g.gMin}|${g.gMax}`;

function chunkGrid(seed: number, cx: number, cy: number, gen: BaseGenParams): TerrainKey[] {
	const key = `${genSig(gen)}:${seed}:${cx}:${cy}`;
	const hit = cache.get(key);
	if (hit) {
		// LRU touch: re-insert so it's most-recently-used.
		cache.delete(key);
		cache.set(key, hit);
		return hit;
	}
	const grid = new Array<TerrainKey>(CHUNK * CHUNK);
	const baseC = cx * CHUNK;
	const baseR = cy * CHUNK;
	// v1 is the only algorithm today; `gen.version` is recorded so a future
	// version can branch here while old boards keep rendering via their own params.
	for (let r = 0; r < CHUNK; r++) {
		for (let c = 0; c < CHUNK; c++) {
			const e = fbm(seed, baseC + c, baseR + r, gen.scale);
			const n = clamp01((e - gen.gMin) / (gen.gMax - gen.gMin));
			grid[r * CHUNK + c] = elevationToTerrain(n, gen.seaLevel);
		}
	}
	if (cache.size >= MAX_CHUNKS) {
		const oldest = cache.keys().next().value;
		if (oldest !== undefined) cache.delete(oldest);
	}
	cache.set(key, grid);
	return grid;
}

/** Positive modulo so negative world coords index into a chunk correctly. */
const mod = (n: number, m: number): number => ((n % m) + m) % m;

/**
 * Base terrain for a world cell — deterministic for a given `seed`, defined for
 * every integer coord, and seamless (sampled in continuous world space).
 */
export function baseTerrainAt(
	seed: number,
	col: number,
	row: number,
	gen: BaseGenParams = DEFAULT_BASE_GEN,
): TerrainKey {
	const grid = chunkGrid(seed, Math.floor(col / CHUNK), Math.floor(row / CHUNK), gen);
	return grid[mod(row, CHUNK) * CHUNK + mod(col, CHUNK)];
}

/** Drop all cached chunks (e.g. on seed change). */
export function clearBaseCache(): void {
	cache.clear();
}

/**
 * A terrain sampler for one render: a painted override wins, otherwise the
 * generated base (when `baseSeed` is set), otherwise the flat `empty` fallback.
 * With a `baseSeed` it is **total** (always returns a terrain) — that is what
 * lets rendering fill the whole viewport and lets autotiling resolve every
 * neighbour without a chunk-boundary gap.
 */
export type TerrainSampler = (col: number, row: number) => TerrainKey | undefined;

export function makeTerrainSampler(
	cells: Cells,
	baseSeed: number | null,
	empty: TerrainKey | null,
	gen: BaseGenParams = DEFAULT_BASE_GEN,
): TerrainSampler {
	if (baseSeed != null) {
		return (col, row) => cells[cellKey(col, row)] ?? baseTerrainAt(baseSeed, col, row, gen);
	}
	return (col, row) => cells[cellKey(col, row)] ?? empty ?? undefined;
}
