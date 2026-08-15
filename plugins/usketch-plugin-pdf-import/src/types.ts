import type { ShapeData } from "@edv4h/usketch-shared";

/** Shape type id registered by this plugin. */
export const PDF_PAGE_SHAPE_TYPE = "pdf-page";

/**
 * One page of a PDF, rendered live from the source document.
 *
 * The shape stores only a reference — the PDF bytes live once in the asset
 * store, no matter how many pages were placed. Pages are rasterized in the
 * browser at whatever resolution the current zoom needs, so they stay sharp
 * instead of being frozen at import-time resolution.
 */
export interface PdfPageShapeData extends ShapeData {
	type: typeof PDF_PAGE_SHAPE_TYPE;
	/** Asset id of the source PDF (shared by every page of that document). */
	assetId: string;
	/** 1-based page number within the source document. */
	pageNumber: number;
	/** Page count of the source document, for labels and debugging. */
	pageCount: number;
	/** Original file name, for labels and debugging. */
	fileName: string;
	/**
	 * Intrinsic page size in PDF points. Cached on the shape so the aspect
	 * ratio is known synchronously, before the document has loaded.
	 */
	pointWidth: number;
	pointHeight: number;
}

/** Intrinsic size of one page, in PDF points. */
export interface PdfPageSize {
	pageNumber: number;
	width: number;
	height: number;
}

export interface PdfImportOptions {
	/**
	 * Max accepted size of the PDF file. Default 50 (MB). The whole document is
	 * stored in the asset store, so this bounds what lands in the board.
	 */
	maxSizeMB?: number;
	/**
	 * Max pages placed from one PDF. Default 50. Unlike a rasterizing importer,
	 * page count does not affect stored bytes — the cost is shape count and
	 * live render load, so this cap is about board manageability.
	 */
	maxPages?: number;
	/** Longest side of each placed page, in world units. Default 480. */
	maxPageWorldSize?: number;
	/** Gap between grid cells, in world units. Default 24. */
	gap?: number;
	/** Default 0 (lowest, so third-party plugins win). */
	order?: number;
	/**
	 * Zoom out after import so the whole page grid is visible. Default true.
	 * Never zooms in — an import that already fits leaves the viewport alone.
	 */
	fitOnImport?: boolean;
	/**
	 * Cap on the longest side of a page's render buffer, in device pixels.
	 * Default 4096. Raising it keeps pages sharp at deeper zoom at the cost of
	 * memory — a 4096px A4 page costs roughly 47MB while it is on screen.
	 */
	maxRenderSize?: number;
	/**
	 * URL of the pdf.js worker module. Defaults to a jsDelivr URL pinned to the
	 * bundled pdf.js version. Override to self-host — the worker build **must**
	 * match the `pdfjs-dist` version this plugin depends on, or pdf.js refuses
	 * to start.
	 */
	workerSrc?: string;
}

/** Payload of the `pdf-import:progress` event, emitted once per placed page. */
export interface PdfImportProgressEvent {
	fileName: string;
	/** 1-based index of the page that was just measured. */
	page: number;
	/** Number of pages this import will place. */
	totalPages: number;
}
