// Level-of-detail for the terrain MapLayer. Zoomed out, a large map puts a huge
// number of cells on screen; per-cell SVG pattern fills (and the wobble filter)
// then cost far too much. Two tiers keep the rendered node count bounded:
//   full   → per-cell pattern + autotile strips + wobble (only when tiles are big,
//            so few cells are visible)
//   coarse → flat colour, cells always merged into blocks sized to stay ~constant
//            on screen, so the node count is capped regardless of map size / zoom
import type { RenderMode } from "@edv4h/usketch-shared";
import { type Cells, cellKey, parseCellKey } from "./autotile.js";
import type { TerrainKey } from "./terrain.js";

export type TileDetail = "full" | "coarse";

/** On-screen px per tile at/above which full (pattern) detail is affordable. */
export const FULL_MIN_PX = 24;
/** Target on-screen px per merged block in the coarse tier. */
export const COARSE_BLOCK_PX = 24;

/**
 * Pick a detail tier from the on-screen tile size (world tile × zoom, in px). A
 * global `renderMode` of "lod" forces coarse so the map simplifies in step with
 * the rest of the canvas.
 */
export function tileDetail(screenTilePx: number, renderMode?: RenderMode): TileDetail {
	if (renderMode === "lod") return "coarse";
	return screenTilePx >= FULL_MIN_PX ? "full" : "coarse";
}

/**
 * Cells per side to merge into one block in the coarse tier (≥1). Uses `ceil` so
 * that below the full threshold the factor is always ≥2 — coarse never falls back
 * to one node per cell, keeping the on-screen block size ~`COARSE_BLOCK_PX`.
 */
export function blockFactor(screenTilePx: number): number {
	if (screenTilePx <= 0) return 1;
	return Math.max(1, Math.ceil(COARSE_BLOCK_PX / screenTilePx));
}

// Cache the (O(totalCells)) block map per cells object + factor. Keyed by the
// `cells` object identity, so pan (same cells) hits the cache and a tilemap edit
// (new cells object) is a natural miss; the WeakMap lets the old entry be GC'd.
const downsampleCache = new WeakMap<Cells, Map<number, Record<string, TerrainKey>>>();

/**
 * Downsample cells into `factor`×`factor` blocks, each labelled with its majority
 * terrain. Keys are BLOCK coordinates (`blockCol,blockRow`); a block spans world
 * rect `[bc*factor*tile … ]`. Reduces node count by up to factor² when far out.
 */
export function downsampleCells(cells: Cells, factor: number): Record<string, TerrainKey> {
	if (factor <= 1) return { ...cells };
	let byFactor = downsampleCache.get(cells);
	if (!byFactor) {
		byFactor = new Map();
		downsampleCache.set(cells, byFactor);
	}
	const cached = byFactor.get(factor);
	if (cached) return cached;

	const votes = new Map<string, Map<TerrainKey, number>>();
	for (const [key, terrain] of Object.entries(cells)) {
		const [c, r] = parseCellKey(key);
		const bk = cellKey(Math.floor(c / factor), Math.floor(r / factor));
		let m = votes.get(bk);
		if (!m) {
			m = new Map();
			votes.set(bk, m);
		}
		m.set(terrain, (m.get(terrain) ?? 0) + 1);
	}
	const out: Record<string, TerrainKey> = {};
	for (const [bk, m] of votes) {
		let best: TerrainKey | null = null;
		let bestN = -1;
		for (const [t, n] of m) {
			if (n > bestN) {
				bestN = n;
				best = t;
			}
		}
		if (best) out[bk] = best;
	}
	byFactor.set(factor, out);
	return out;
}
