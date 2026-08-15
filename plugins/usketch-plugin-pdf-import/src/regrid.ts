import { layoutPagesInGrid } from "./layout.js";
import type { PdfPageShapeData } from "./types.js";

/** New top-left position for one page. */
export interface PagePatch {
	id: string;
	x: number;
	y: number;
}

/**
 * How many columns the pages are currently arranged in, read back from their
 * positions rather than stored on the shapes — so the toolbar still shows a
 * sensible number after pages have been moved, undone, or synced from a peer.
 */
export function detectColumns(pages: readonly PdfPageShapeData[]): number {
	if (pages.length === 0) return 0;
	const topY = Math.min(...pages.map((p) => p.y));
	// Pages of different heights are centered in their cell, so a row's `y`
	// values are close but not equal — compare against a fraction of the
	// shortest page rather than requiring an exact match.
	const tolerance = Math.min(...pages.map((p) => p.height)) / 2;
	return pages.filter((p) => p.y - topY <= tolerance).length;
}

/**
 * Rearrange pages into `columns`, pinning the group's **top edge** and
 * horizontal center. Those are exactly the two coordinates the grid toolbar is
 * anchored to, so the bar stays put between clicks instead of sliding out from
 * under the cursor as the row count changes. The grid therefore grows downward.
 *
 * Reading order (document, then page number) is restored, so a reflow also
 * tidies up pages that were dragged out of sequence.
 */
export function reflowPages(
	pages: readonly PdfPageShapeData[],
	columns: number,
	gap: number,
): PagePatch[] {
	if (pages.length === 0) return [];

	const ordered = [...pages].sort(
		(a, b) => a.assetId.localeCompare(b.assetId) || a.pageNumber - b.pageNumber,
	);

	const top = Math.min(...pages.map((p) => p.y));
	const center = {
		x: (Math.min(...pages.map((p) => p.x)) + Math.max(...pages.map((p) => p.x + p.width))) / 2,
		y: (top + Math.max(...pages.map((p) => p.y + p.height))) / 2,
	};

	const grid = layoutPagesInGrid(
		ordered.map((p) => ({ width: p.width, height: p.height })),
		{ gap, center, columns: clampColumns(columns, ordered.length) },
	);

	// `layoutPagesInGrid` centers on the given point; slide the finished grid so
	// its top lands back on the group's original top edge.
	const dy = top - grid.y;

	return ordered.flatMap((page, index) => {
		const position = grid.positions[index];
		return position ? [{ id: page.id, x: position.x, y: position.y + dy }] : [];
	});
}

/** At least one column, never more than there are pages to fill them. */
export function clampColumns(columns: number, pageCount: number): number {
	if (pageCount <= 0) return 1;
	return Math.min(Math.max(Math.floor(columns), 1), pageCount);
}
