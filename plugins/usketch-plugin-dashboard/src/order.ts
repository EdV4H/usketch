// Derive the dashboard's item order from geometry — no persisted `order[]`. Once
// items are packed into cells, their positions ARE the order: a row-major
// (top-to-bottom, then left-to-right) reading of the grid recovers it uniquely.
// Because position is already synced + undoable through the shape store, deriving
// order from position means order is synced and reload-stable for free.
import type { ShapeData } from "@edv4h/usketch-shared";
import type { GridSpec } from "./grid.js";

/**
 * Row-major reading order of `items` given the grid geometry. Items are bucketed
 * into rows by their Y (tolerant of sub-cell jitter, since a whole row shares a
 * band), then sorted left-to-right within each row. Ties are broken by original
 * array order so the result is stable across calls with equal positions.
 */
export function readingOrder(items: readonly ShapeData[], spec: GridSpec): string[] {
	const rowStep = spec.cellH + spec.gap;
	const rowBucket = (y: number): number =>
		rowStep > 0 ? Math.round((y - spec.originY - spec.padding) / rowStep) : 0;

	return items
		.map((s, i) => ({ id: s.id, row: rowBucket(s.y), x: s.x, i }))
		.sort((a, b) => a.row - b.row || a.x - b.x || a.i - b.i)
		.map((e) => e.id);
}
