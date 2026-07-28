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
 * Which sides of cell (c,r) border a different terrain (or empty). These get the
 * "one shade darker" strip in the design — the region's outer ring.
 */
export function exposedEdges(cells: Cells, col: number, row: number): ExposedEdges {
	const self = cells[cellKey(col, row)];
	const diff = (c: number, r: number) => cells[cellKey(c, r)] !== self;
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
