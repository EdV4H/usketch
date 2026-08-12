// Pure grid/autotile helpers for the tilemap. No DOM — unit-tested directly.
import type { BoundingBox } from "@edv4h/usketch-shared";
import type { TerrainKey } from "./terrain.js";

export type Cells = Record<string, TerrainKey>;

/** Sparse-map key for a cell. */
export function cellKey(col: number, row: number): string {
	return `${col},${row}`;
}

export function parseCellKey(key: string): [col: number, row: number] {
	const i = key.indexOf(",");
	return [Number(key.slice(0, i)), Number(key.slice(i + 1))];
}

/** World point → grid cell (origin at world 0,0; tiles are `tile` wide/tall). */
export function worldToCell(x: number, y: number, tile: number): [col: number, row: number] {
	return [Math.floor(x / tile), Math.floor(y / tile)];
}

/**
 * Terrain at a cell, treating unset cells as the `empty` fallback (e.g. "water"),
 * so callers can judge off-map / unpainted space as sea. Returns `undefined` only
 * when the cell is unset and no fallback is given.
 */
export function terrainAtCell(
	cells: Cells,
	col: number,
	row: number,
	empty?: TerrainKey | null,
): TerrainKey | undefined {
	return cells[cellKey(col, row)] ?? empty ?? undefined;
}

/** Bounding box (world units) enclosing all painted cells. Empty → zero box. */
export function cellsBounds(cells: Cells, tile: number): BoundingBox {
	let minC = Infinity;
	let minR = Infinity;
	let maxC = -Infinity;
	let maxR = -Infinity;
	for (const key of Object.keys(cells)) {
		const [c, r] = parseCellKey(key);
		if (c < minC) minC = c;
		if (r < minR) minR = r;
		if (c > maxC) maxC = c;
		if (r > maxR) maxR = r;
	}
	if (minC === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
	return {
		x: minC * tile,
		y: minR * tile,
		width: (maxC - minC + 1) * tile,
		height: (maxR - minR + 1) * tile,
	};
}

export interface ExposedEdges {
	n: boolean;
	e: boolean;
	s: boolean;
	w: boolean;
}

/**
 * Which sides of cell (c,r) border a different terrain. Unset neighbours count as
 * `empty` (the fallback terrain), so e.g. a water tile next to unpainted space
 * with `empty="water"` is NOT an exposed edge — no spurious coastline against the
 * empty-terrain background. `empty` omitted → unset neighbours are always different.
 */
export function exposedEdges(
	cells: Cells,
	col: number,
	row: number,
	empty?: TerrainKey | null,
): ExposedEdges {
	const self = cells[cellKey(col, row)];
	const diff = (c: number, r: number) => terrainAtCell(cells, c, r, empty) !== self;
	return {
		n: diff(col, row - 1),
		e: diff(col + 1, row),
		s: diff(col, row + 1),
		w: diff(col - 1, row),
	};
}

export interface CellBox {
	minC: number;
	minR: number;
	maxC: number;
	maxR: number;
}

/**
 * Connected region (4-neighbour) of cells sharing the start cell's current
 * terrain. Returns the keys to repaint. When the start cell is empty, `box`
 * (in cell coordinates) is required to keep the flood bounded.
 */
export function floodFill(
	cells: Cells,
	startCol: number,
	startRow: number,
	box?: CellBox,
): string[] {
	const target = cells[cellKey(startCol, startRow)]; // TerrainKey | undefined (empty)
	if (target === undefined && !box) return [];
	const inBox = (c: number, r: number) =>
		!box || (c >= box.minC && c <= box.maxC && r >= box.minR && r <= box.maxR);
	if (!inBox(startCol, startRow)) return [];

	const out: string[] = [];
	const seen = new Set<string>();
	const stack: [number, number][] = [[startCol, startRow]];
	while (stack.length) {
		const next = stack.pop();
		if (!next) break;
		const [c, r] = next;
		const key = cellKey(c, r);
		if (seen.has(key)) continue;
		if (!inBox(c, r)) continue;
		if (cells[key] !== target) continue;
		seen.add(key);
		out.push(key);
		stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
	}
	return out;
}

/**
 * Region fill: the `floodFill` region from the start cell, but empty when the
 * start terrain is protected (present in `exclude`) — clicking a protected
 * terrain is a no-op. Because `floodFill` only spreads across the start cell's
 * own terrain, a non-excluded start can never reach a protected cell, so the
 * whole returned region is safe to repaint. Backs the map tool's "region" fill
 * mode (fill a connected same-terrain area while keeping excluded terrains,
 * e.g. water, untouched).
 */
export function regionFillCells(
	cells: Cells,
	startCol: number,
	startRow: number,
	exclude: ReadonlySet<string>,
	box?: CellBox,
): string[] {
	const start = cells[cellKey(startCol, startRow)];
	if (start !== undefined && exclude.has(start)) return [];
	return floodFill(cells, startCol, startRow, box);
}

/** A terrain lookup for any cell (override ?? base ?? empty); may be undefined. */
export type CellSampler = (col: number, row: number) => TerrainKey | undefined;

export interface SamplerFloodResult {
	/** Cell keys forming the connected region (empty when the start is undefined). */
	cells: string[];
	/**
	 * `true` if the flood hit `maxCells` before the region closed — i.e. the region
	 * is not enclosed (or is larger than the cap). Callers should treat this as
	 * "cannot fill" rather than filling an arbitrary blob.
	 */
	truncated: boolean;
}

/**
 * Flood fill over a **sampler** (override ?? base ?? empty) rather than the sparse
 * override map — this is what makes region fill work on the infinite base terrain,
 * where unpainted cells still have a real (generated) terrain. Because that field
 * is boundless, the flood is capped by `maxCells` and uses **breadth-first** order
 * so a capped result is a compact blob around the start. If it hits the cap before
 * the region closes, `truncated` is set and the caller aborts (the region is open,
 * e.g. an infinite ocean). An `undefined` start terrain yields an empty region.
 */
export function samplerFloodFill(
	sample: CellSampler,
	startCol: number,
	startRow: number,
	maxCells: number,
): SamplerFloodResult {
	const target = sample(startCol, startRow);
	if (target === undefined) return { cells: [], truncated: false };

	const out: string[] = [];
	const seen = new Set<string>([cellKey(startCol, startRow)]);
	const queue: [number, number][] = [[startCol, startRow]];
	let head = 0;
	while (head < queue.length) {
		const [c, r] = queue[head++];
		if (sample(c, r) !== target) continue;
		out.push(cellKey(c, r));
		if (out.length >= maxCells) return { cells: out, truncated: true };
		for (const [nc, nr] of [
			[c + 1, r],
			[c - 1, r],
			[c, r + 1],
			[c, r - 1],
		] as const) {
			const k = cellKey(nc, nr);
			if (!seen.has(k)) {
				seen.add(k);
				queue.push([nc, nr]);
			}
		}
	}
	return { cells: out, truncated: false };
}
