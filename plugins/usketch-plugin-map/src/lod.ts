// Level-of-detail for the terrain MapLayer. When tiles get small on screen (zoom
// out, or a large map), the per-cell pattern fills + autotile edge strips + cell
// separators are invisible yet expensive, so we render progressively simpler:
//   full → pattern + autotile strips + wobble
//   mid  → pattern fill only (no strips/separators/wobble)
//   low  → flat colour, cells downsampled into merged blocks (fewer DOM nodes)
import { type Cells, cellKey, parseCellKey } from "./autotile.js";
import type { TerrainKey } from "./terrain.js";

export type TileDetail = "full" | "mid" | "low";

/** On-screen px per tile at/above which full detail is worthwhile. */
export const FULL_MIN_PX = 14;
/** On-screen px per tile at/above which the pattern fill is still worthwhile. */
export const MID_MIN_PX = 6;
/** Target on-screen px per merged block in the low tier. */
export const LOW_BLOCK_PX = 12;

/**
 * Pick a detail tier from the on-screen tile size (world tile × zoom, in px).
 * A global `renderMode` of "lod" caps detail at "mid" so the map simplifies in
 * step with the rest of the canvas.
 */
export function tileDetail(screenTilePx: number, renderMode?: string): TileDetail {
	if (renderMode === "lod") return screenTilePx >= MID_MIN_PX ? "mid" : "low";
	if (screenTilePx >= FULL_MIN_PX) return "full";
	if (screenTilePx >= MID_MIN_PX) return "mid";
	return "low";
}

/** How many cells per side to merge into one block in the low tier (≥1). */
export function blockFactor(screenTilePx: number): number {
	if (screenTilePx <= 0) return 1;
	return Math.max(1, Math.round(LOW_BLOCK_PX / screenTilePx));
}

/**
 * Downsample cells into `factor`×`factor` blocks, each labelled with its majority
 * terrain. Keys are BLOCK coordinates (`blockCol,blockRow`). A block spans world
 * rect `[bc*factor*tile … ]`. Reduces DOM node count by up to factor² when far out.
 */
export function downsampleCells(cells: Cells, factor: number): Record<string, TerrainKey> {
	if (factor <= 1) return { ...cells };
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
	return out;
}
