// Pure grid geometry for the dashboard: a fixed-cell flow grid anchored at a world
// origin, where each item occupies a whole-number block of cells (`cols × rows`)
// sized from its own width/height — like a real dashboard's tiles (Grafana,
// react-grid-layout). Items flow left→right, top→bottom and pack around each
// other; a wider/taller item simply takes more cells. Only the top-LEFT of each
// item is snapped (its footprint is measured in cells, but it is never resized).
//
// All functions here are pure and side-effect free, so they can be unit-tested in
// isolation and reused by both the runtime and the service `repack()` path.

/** Fixed-cell flow-grid geometry. `originX`/`originY` is the world anchor of the
 *  first cell's outer corner; `padding` insets the first cell from that anchor. */
export interface GridSpec {
	/** Number of columns before wrapping to the next row (>= 1). */
	columns: number;
	/** Base cell width in world units. */
	cellW: number;
	/** Base cell height in world units. */
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

/** An item to place, with the size that determines its cell footprint. */
export interface ItemSize {
	id: string;
	width: number;
	height: number;
}

/** How many cells an item occupies, per axis (>= 1). */
export interface Span {
	cols: number;
	rows: number;
}

function clamp(n: number, min: number, max: number): number {
	if (n < min) return min;
	if (n > max) return max;
	return n;
}

/** Normalize a spec's column count to a positive integer. */
function colsOf(spec: GridSpec): number {
	return Math.max(1, Math.floor(spec.columns));
}

/** World top-left of the cell at grid coordinate (`col`, `row`). */
export function cellXY(col: number, row: number, spec: GridSpec): { x: number; y: number } {
	return {
		x: spec.originX + spec.padding + col * (spec.cellW + spec.gap),
		y: spec.originY + spec.padding + row * (spec.cellH + spec.gap),
	};
}

/**
 * World top-left of the cell at flow `index` (row-major, single-cell items). Used
 * by the grid overlay to draw the base cells; item placement uses {@link packSpans}.
 */
export function cellTopLeft(index: number, spec: GridSpec): { x: number; y: number } {
	const cols = colsOf(spec);
	const i = Math.max(0, Math.floor(index));
	return cellXY(i % cols, Math.floor(i / cols), spec);
}

/**
 * How many cells a `width × height` item spans. A size that fits within one cell
 * spans 1; every extra `cellW + gap` (resp. `cellH + gap`) of size adds a cell.
 * Column span is clamped to the grid width; row span has no upper bound.
 */
export function spanOf(width: number, height: number, spec: GridSpec): Span {
	const stepX = spec.cellW + spec.gap;
	const stepY = spec.cellH + spec.gap;
	const cols = stepX > 0 ? Math.ceil((width + spec.gap) / stepX) : 1;
	const rows = stepY > 0 ? Math.ceil((height + spec.gap) / stepY) : 1;
	return {
		cols: clamp(cols, 1, colsOf(spec)),
		rows: Math.max(1, rows),
	};
}

/** A placed item with its footprint, used to compute a drop index. */
export interface PlacedBox {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Insertion index for a dragged item whose centre is at `point`, given the OTHER
 * items in reading order with their (compact) placed footprints. An item counts
 * as "before" the point when it's on an earlier row band, or the same band and
 * left of the point. Since `boxesInOrder` is row-major, the first not-before item
 * ends the count — the result is a clean `[0, boxesInOrder.length]` index.
 */
export function targetIndexFromPoint(
	point: { x: number; y: number },
	boxesInOrder: readonly PlacedBox[],
	spec: GridSpec,
): number {
	const rowStep = spec.cellH + spec.gap;
	const band = (y: number): number =>
		rowStep > 0 ? Math.round((y - spec.originY - spec.padding) / rowStep) : 0;
	const pointerBand = band(point.y);
	let index = 0;
	for (const box of boxesInOrder) {
		const cx = box.x + box.width / 2;
		const cy = box.y + box.height / 2;
		const b = band(cy);
		const before = b < pointerBand || (b === pointerBand && cx < point.x);
		if (!before) break;
		index++;
	}
	return index;
}

/**
 * Pack sized items into the grid in order, first-fit / non-dense: each item is
 * placed at the first free footprint at or after the previous item's start (so
 * order is preserved and earlier holes are not back-filled), wrapping to the next
 * row when it doesn't fit the remaining columns. Returns each item's top-left
 * world position in the SAME order as `items`.
 */
export function packSpans(items: readonly ItemSize[], spec: GridSpec): Placement[] {
	const cols = colsOf(spec);
	const occupied = new Set<string>();
	const key = (r: number, c: number) => `${r},${c}`;
	const fits = (r: number, c: number, sr: number, sc: number): boolean => {
		if (c + sc > cols) return false;
		for (let dr = 0; dr < sr; dr++) {
			for (let dc = 0; dc < sc; dc++) {
				if (occupied.has(key(r + dr, c + dc))) return false;
			}
		}
		return true;
	};
	const mark = (r: number, c: number, sr: number, sc: number): void => {
		for (let dr = 0; dr < sr; dr++) {
			for (let dc = 0; dc < sc; dc++) occupied.add(key(r + dr, c + dc));
		}
	};

	const out: Placement[] = [];
	let curR = 0;
	let curC = 0;
	for (const item of items) {
		const span = spanOf(item.width, item.height, spec);
		const sc = span.cols;
		const sr = span.rows;
		let r = curR;
		let c = curC;
		// Forward scan from the cursor for the first fitting footprint.
		while (true) {
			if (c + sc > cols) {
				c = 0;
				r++;
				continue;
			}
			if (fits(r, c, sr, sc)) break;
			c++;
		}
		mark(r, c, sr, sc);
		out.push({ id: item.id, ...cellXY(c, r, spec) });
		// Advance the cursor past this item's leading cell.
		curR = r;
		curC = c + sc;
		if (curC >= cols) {
			curC = 0;
			curR = r + 1;
		}
	}
	return out;
}
