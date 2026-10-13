import { clampColumns, layoutPagesInGrid } from "./layout.js";
import type { PdfPageShapeData } from "./types.js";

/** New top-left position for one page. */
export interface PagePatch {
	id: string;
	x: number;
	y: number;
}

/**
 * How many columns the pages are currently arranged in, read back from their
 * positions rather than stored on the shapes — so the HUD still shows a
 * sensible number after pages have been moved, undone, or synced from a peer.
 */
export function detectColumns(pages: readonly PdfPageShapeData[]): number {
	if (pages.length === 0) return 0;
	const topY = Math.min(...pages.map((p) => p.y));
	// Pages are centered in cells as tall as the tallest page, so a first-row
	// page sits less than half a cell below the top, while the second row
	// starts a full cell (plus gap) down. Half the *tallest* page separates the
	// two; half the shortest would cut a mixed-height first row short.
	const tolerance = Math.max(...pages.map((p) => p.height)) / 2;
	return pages.filter((p) => p.y - topY < tolerance).length;
}

/**
 * Rearrange pages into `columns`, pinning the grid's **top edge** and
 * horizontal center. Pinning the top keeps the first row where the user is looking
 * as the row count changes; the grid therefore grows downward.
 *
 * Both are measured on the grid's cells, not on the pages: a page shorter than
 * the tallest one sits centered in its cell, below the cell top. Pinning the
 * topmost *page* instead would push the grid down by that inset on every
 * reflow whenever the tallest page is not in the first row.
 *
 * Reading order (document, then page number) is restored, so a reflow also
 * tidies up pages that were dragged out of sequence. Documents keep the order
 * their first pages are currently in, read row by row — so an import keeps its
 * left-to-right order, and repeated reflows never reshuffle documents.
 */
export function reflowPages(
	pages: readonly PdfPageShapeData[],
	columns: number,
	gap: number,
): PagePatch[] {
	if (pages.length === 0) return [];

	const cellWidth = Math.max(...pages.map((p) => p.width));
	const cellHeight = Math.max(...pages.map((p) => p.height));
	const documentRank = rankDocuments(pages, cellHeight / 2);
	const ordered = [...pages].sort(
		(a, b) =>
			(documentRank.get(a.assetId) ?? 0) - (documentRank.get(b.assetId) ?? 0) ||
			a.pageNumber - b.pageNumber,
	);

	// Recover the cell box each page sits centered in.
	const top = Math.min(...pages.map((p) => p.y - (cellHeight - p.height) / 2));
	const left = Math.min(...pages.map((p) => p.x - (cellWidth - p.width) / 2));
	const right = Math.max(...pages.map((p) => p.x + (cellWidth + p.width) / 2));

	// `layoutPagesInGrid` centers the grid, so aim its center half the new
	// grid's height below the top edge.
	const rows = Math.ceil(pages.length / clampColumns(columns, pages.length));
	const height = rows * cellHeight + (rows - 1) * gap;
	const grid = layoutPagesInGrid(
		ordered.map((p) => ({ width: p.width, height: p.height })),
		{ gap, center: { x: (left + right) / 2, y: top + height / 2 }, columns },
	);

	return ordered.flatMap((page, index) => {
		const position = grid.positions[index];
		return position ? [{ id: page.id, x: position.x, y: position.y }] : [];
	});
}

/**
 * Rank each document by where its first page sits: rows top to bottom, then
 * left to right within a row. Two first pages less than `rowTolerance` apart
 * vertically count as one row.
 */
function rankDocuments(
	pages: readonly PdfPageShapeData[],
	rowTolerance: number,
): Map<string, number> {
	const leaders = new Map<string, PdfPageShapeData>();
	for (const page of pages) {
		const leader = leaders.get(page.assetId);
		if (!leader || page.pageNumber < leader.pageNumber) leaders.set(page.assetId, page);
	}
	const sorted = [...leaders.values()].sort((a, b) => {
		const dy = a.y + a.height / 2 - (b.y + b.height / 2);
		if (Math.abs(dy) >= rowTolerance) return dy;
		return a.x + a.width / 2 - (b.x + b.width / 2) || a.assetId.localeCompare(b.assetId);
	});
	return new Map(sorted.map((leader, rank) => [leader.assetId, rank]));
}
