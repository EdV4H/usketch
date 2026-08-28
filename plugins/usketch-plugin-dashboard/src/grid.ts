// Pure grid geometry for the dashboard: a uniform, fixed-cell flow grid anchored
// at a world origin. Unlike the container plugin's `gridLayout` (which shares the
// container's inner width across columns and RESIZES children to fit), the
// dashboard uses fixed `cellW`/`cellH` cells and only snaps each item's TOP-LEFT
// — shapes keep their own size, so reordering never distorts them.
//
// All functions here are pure and side-effect free, so they can be unit-tested
// in isolation and reused by both the runtime and the service `repack()` path.

/** Fixed-cell flow-grid geometry. `originX`/`originY` is the world anchor of the
 *  first cell's outer corner; `padding` insets the first cell from that anchor. */
export interface GridSpec {
	/** Number of columns before wrapping to the next row (>= 1). */
	columns: number;
	/** Cell width in world units. */
	cellW: number;
	/** Cell height in world units. */
	cellH: number;
	/** Gap between adjacent cells (both axes). */
	gap: number;
	/** Inset from the origin anchor to the first cell. */
	padding: number;
	/** World X anchor of the grid's outer corner. */
	originX: number;
	/** World Y anchor of the grid's outer corner. */
	originY: number;
}

/** A resolved top-left position for one item. The dashboard never writes size. */
export interface Placement {
	id: string;
	x: number;
	y: number;
}

/** Clamp `n` to `[min, max]`. */
function clamp(n: number, min: number, max: number): number {
	if (n < min) return min;
	if (n > max) return max;
	return n;
}

/** Normalize a spec's column count to a positive integer. */
function colsOf(spec: GridSpec): number {
	return Math.max(1, Math.floor(spec.columns));
}

/** Top-left world position of the cell at flow `index` (row-major). */
export function cellTopLeft(index: number, spec: GridSpec): { x: number; y: number } {
	const cols = colsOf(spec);
	const i = Math.max(0, Math.floor(index));
	const col = i % cols;
	const row = Math.floor(i / cols);
	return {
		x: spec.originX + spec.padding + col * (spec.cellW + spec.gap),
		y: spec.originY + spec.padding + row * (spec.cellH + spec.gap),
	};
}

/** Snap each item, in order, to consecutive cells. */
export function packGrid(itemIds: readonly string[], spec: GridSpec): Placement[] {
	return itemIds.map((id, i) => {
		const { x, y } = cellTopLeft(i, spec);
		return { id, x, y };
	});
}

/**
 * Pack every item EXCEPT `draggingId`, leaving the cell at `targetIndex` empty so
 * the dragged item visually slots in there. Used for live reflow while dragging:
 * the dragged shape stays under the pointer (never repositioned here) and its
 * siblings shift to open a gap. `targetIndex` is clamped to the number of
 * non-dragging items (an end insertion opens the last slot).
 */
export function packGridWithGap(
	itemIds: readonly string[],
	draggingId: string,
	targetIndex: number,
	spec: GridSpec,
): Placement[] {
	const others = itemIds.filter((id) => id !== draggingId);
	const gapAt = clamp(Math.round(targetIndex), 0, others.length);
	const placements: Placement[] = [];
	let slot = 0;
	for (const id of others) {
		if (slot === gapAt) slot++; // skip the reserved slot
		const { x, y } = cellTopLeft(slot, spec);
		placements.push({ id, x, y });
		slot++;
	}
	return placements;
}

/**
 * Inverse of {@link cellTopLeft}: which flow index a world point lands on. Used
 * to turn a dragged item's centre into an insertion index. Returns a value in
 * `[0, count]` (inclusive end, so the item can be appended past the last cell).
 */
export function indexFromPoint(
	point: { x: number; y: number },
	spec: GridSpec,
	count: number,
): number {
	const cols = colsOf(spec);
	const stepX = spec.cellW + spec.gap;
	const stepY = spec.cellH + spec.gap;
	const relX = point.x - spec.originX - spec.padding;
	const relY = point.y - spec.originY - spec.padding;
	// `round` picks the nearest cell centre-line: dragging past a cell's midpoint
	// flips the insertion side, which is what makes reflow feel responsive.
	const col = clamp(Math.round(stepX > 0 ? relX / stepX : 0), 0, cols - 1);
	const row = Math.max(0, Math.round(stepY > 0 ? relY / stepY : 0));
	return clamp(row * cols + col, 0, Math.max(0, count));
}
