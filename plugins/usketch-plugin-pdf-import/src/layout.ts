/** World-space footprint of one rendered page. */
export interface PageSize {
	width: number;
	height: number;
}

export interface GridLayoutOptions {
	/** Space between cells, in world units. */
	gap: number;
	/** World point the whole grid is centered on. */
	center: { x: number; y: number };
	/**
	 * Pages per row. Omit for a roughly square grid (`ceil(sqrt(n))`), which is
	 * the shape a freshly imported document gets.
	 */
	columns?: number;
}

export interface GridLayout {
	/** Top-left world position of each page, in source order. */
	positions: { x: number; y: number }[];
	cols: number;
	rows: number;
	/** Bounding box of the whole grid, gaps included. */
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Lay pages out left-to-right, wrapping into rows — the reading order users
 * expect from a document, and the same shape Miro's "Extract pages" produces.
 *
 * Cells are uniform (sized to the largest page) so mixed portrait/landscape
 * PDFs still line up on a regular grid, with each page centered in its cell
 * rather than jammed against a corner.
 */
export function layoutPagesInGrid(
	pages: readonly PageSize[],
	{ gap, center, columns }: GridLayoutOptions,
): GridLayout {
	if (pages.length === 0) {
		return { positions: [], cols: 0, rows: 0, x: center.x, y: center.y, width: 0, height: 0 };
	}

	const cols = columns
		? Math.min(Math.max(Math.floor(columns), 1), pages.length)
		: Math.ceil(Math.sqrt(pages.length));
	const rows = Math.ceil(pages.length / cols);
	const cellWidth = Math.max(...pages.map((p) => p.width));
	const cellHeight = Math.max(...pages.map((p) => p.height));

	const width = cols * cellWidth + (cols - 1) * gap;
	const height = rows * cellHeight + (rows - 1) * gap;
	const originX = center.x - width / 2;
	const originY = center.y - height / 2;

	const positions = pages.map((page, index) => {
		const col = index % cols;
		const row = Math.floor(index / cols);
		return {
			x: Math.round(originX + col * (cellWidth + gap) + (cellWidth - page.width) / 2),
			y: Math.round(originY + row * (cellHeight + gap) + (cellHeight - page.height) / 2),
		};
	});

	return { positions, cols, rows, x: originX, y: originY, width, height };
}
