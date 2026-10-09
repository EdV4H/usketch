import type { BoardStore, Command, ShapeData } from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand } from "@edv4h/usketch-store";
import { detectColumns, reflowPages } from "./regrid.js";
import { PDF_PAGE_SHAPE_TYPE, type PdfPageShapeData } from "./types.js";

function isPdfPage(shape: ShapeData | undefined): shape is PdfPageShapeData {
	return shape?.type === PDF_PAGE_SHAPE_TYPE;
}

/** The PDF pages in the current selection, in selection order. */
export function selectedPdfPages(store: BoardStore): PdfPageShapeData[] {
	const shapes = store.getShapes();
	return [...store.getSelection()].map((id) => shapes.get(id)).filter(isPdfPage);
}

/**
 * Columns the selected PDF pages are laid out in, or 0 when fewer than two
 * pages are selected — a single page has no arrangement to speak of.
 */
export function getSelectedPdfColumns(store: BoardStore): number {
	const pages = selectedPdfPages(store);
	return pages.length < 2 ? 0 : detectColumns(pages);
}

/** The roughly square arrangement a fresh import gets, for `pageCount` pages. */
export function squareColumns(pageCount: number): number {
	return Math.ceil(Math.sqrt(Math.max(pageCount, 1)));
}

/**
 * Undoable command that rearranges the selected PDF pages into `columns`
 * (clamped to the page count). Returns null when there is nothing to do: fewer
 * than two pages selected, or the pages already sit where the grid puts them.
 */
export function createSetPdfColumnsCommand(
	store: BoardStore,
	columns: number,
	gap: number,
): Command | null {
	const pages = selectedPdfPages(store);
	if (pages.length < 2 || !Number.isFinite(columns)) return null;

	const patches = reflowPages(pages, columns, gap);
	const updates = patches.flatMap((patch) => {
		const current = pages.find((p) => p.id === patch.id);
		if (!current || (current.x === patch.x && current.y === patch.y)) return [];
		return [{ id: patch.id, from: { x: current.x, y: current.y }, to: { x: patch.x, y: patch.y } }];
	});
	return updates.length === 0 ? null : createBatchUpdateShapesCommand(store, updates);
}
