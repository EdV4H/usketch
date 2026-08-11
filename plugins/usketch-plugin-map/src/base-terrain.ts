// Deterministic, infinite base terrain — a pure function of (seed, world cell).
// Because every cell is defined for any integer coord, the map can be panned
// forever (no stored data for unedited space) AND autotiling never sees an
// "unset" neighbour at a chunk boundary (there are no boundaries in the field).
import { type Cells, cellKey } from "./autotile.js";
import { elevationToTerrain } from "./generators/index.js";
import { fbm } from "./generators/noise.js";
import type { TerrainKey } from "./terrain.js";

/** Base-frequency of the elevation field (smaller ⇒ larger continents). */
const BASE_SCALE = 0.05;
/** Fraction of the (normalised) range below which is water. */
const BASE_SEA_LEVEL = 0.42;
/**
 * Fixed global contrast window replacing the generators' box-local min/max
 * normalisation. Measured `fbm` output is roughly [-0.32, 0.35] centred near 0
 * (p10≈-0.12, p90≈0.18), so this window stretches its bulk to [0,1], giving
 * `seaLevel` a stable meaning AND keeping terrain bands continuous across the
 * whole infinite plane (a box-local stretch would seam at chunk borders).
 */
const G_MIN = -0.25;
const G_MAX = 0.25;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

// ── Per-chunk cache ──
// `baseTerrainAt` is called per visible cell every frame; caching a chunk's
// terrains once and evicting far chunks (LRU) keeps it cheap while panning.
const CHUNK = 16;
const MAX_CHUNKS = 1024;
const cache = new Map<string, TerrainKey[]>();

function chunkGrid(seed: number, cx: number, cy: number): TerrainKey[] {
	const key = `${seed}:${cx}:${cy}`;
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
	for (let r = 0; r < CHUNK; r++) {
		for (let c = 0; c < CHUNK; c++) {
			const e = fbm(seed, baseC + c, baseR + r, BASE_SCALE);
			const n = clamp01((e - G_MIN) / (G_MAX - G_MIN));
			grid[r * CHUNK + c] = elevationToTerrain(n, BASE_SEA_LEVEL);
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
export function baseTerrainAt(seed: number, col: number, row: number): TerrainKey {
	const grid = chunkGrid(seed, Math.floor(col / CHUNK), Math.floor(row / CHUNK));
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
): TerrainSampler {
	if (baseSeed != null) {
		return (col, row) => cells[cellKey(col, row)] ?? baseTerrainAt(baseSeed, col, row);
	}
	return (col, row) => cells[cellKey(col, row)] ?? empty ?? undefined;
}
