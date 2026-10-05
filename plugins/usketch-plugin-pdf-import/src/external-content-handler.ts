import type { AssetStore } from "@edv4h/usketch-plugin-asset-store";
import type {
	BoundingBox,
	ExternalContentHandler,
	ExternalContentHandlerCtx,
} from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { layoutPagesInGrid } from "./layout.js";
import { acquireDocument, explainFailure, readPageSizes, releaseDocument } from "./pdf-document.js";
import { pageStyle } from "./pdf-page-shape.js";
import {
	PDF_PAGE_SHAPE_TYPE,
	type PdfImportOptions,
	type PdfImportProgressEvent,
	type PdfPageShapeData,
	type PdfPageSize,
} from "./types.js";

/** Resolve the shared asset store lazily (undefined if the plugin isn't wired). */
export type GetAssetStore = () => AssetStore | undefined;

/** Emitted once per measured page so hosts can show import progress. */
export const PDF_IMPORT_PROGRESS_EVENT = "pdf-import:progress";

/** Option defaults, shared with the plugin so each lives in one place. */
export const PDF_IMPORT_DEFAULTS = {
	maxSizeMB: 50,
	inlineMaxSizeMB: 4,
	maxPages: 50,
	maxPageWorldSize: 480,
	gap: 24,
	order: 0,
} as const;

/** Screen-pixel margin around an auto-fitted import — the store's default. */
const FIT_PADDING = 40;

/**
 * A file is treated as a PDF by MIME type, falling back to the extension —
 * some browsers hand over an empty `type` for dragged files.
 */
function isPdfFile(file: File): boolean {
	return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/**
 * External-content handler that expands a dropped / pasted PDF into one page
 * shape per page, arranged on a grid. Registered at `order: 0` (lowest) so any
 * third-party plugin can override it.
 *
 * The document is stored once in the asset store and each shape references it
 * by id plus a page number. Nothing is rasterized here: pages are rendered in
 * the browser at whatever resolution the current zoom calls for, so they stay
 * sharp however far the user zooms in.
 */
export function createPdfFileHandler(
	options: PdfImportOptions = {},
	getAssets?: GetAssetStore,
): ExternalContentHandler<"file"> {
	const {
		maxSizeMB = PDF_IMPORT_DEFAULTS.maxSizeMB,
		inlineMaxSizeMB = PDF_IMPORT_DEFAULTS.inlineMaxSizeMB,
		maxPages = PDF_IMPORT_DEFAULTS.maxPages,
		maxPageWorldSize = PDF_IMPORT_DEFAULTS.maxPageWorldSize,
		gap = PDF_IMPORT_DEFAULTS.gap,
		order = PDF_IMPORT_DEFAULTS.order,
		fitOnImport = true,
	} = options;

	return {
		id: "usketch-plugin-pdf-import:pdf-file",
		kind: "file",
		order,
		match: (content) => content.files.some(isPdfFile),
		handle: async (content, ctx) => {
			// Same predicate as `match`, so a re-dispatched remainder can never
			// come back to this handler and loop.
			const pdfs = content.files.filter(isPdfFile);
			const others = content.files.filter((f) => !isPdfFile(f));

			const origin = viewportCenterToWorld(ctx);
			// Grids differ in width, so each one is placed by its left edge, just
			// right of the previous grid. Only the first is centered on the view.
			let nextLeft: number | undefined;
			let imported: BoundingBox | null = null;
			const placedIds: string[] = [];

			for (const file of pdfs) {
				// One PDF must never abort the rest of the batch: the registry runs a
				// single winning handler, so a throw here would silently drop every
				// remaining file, including the non-PDF remainder below.
				try {
					const placed = await importPdf(file, ctx, {
						center: origin,
						left: nextLeft,
						maxSizeMB,
						inlineMaxSizeMB,
						maxPages,
						maxPageWorldSize,
						gap,
						assets: getAssets?.(),
					});
					if (placed) {
						nextLeft = placed.bounds.x + placed.bounds.width + gap;
						imported = imported ? union(imported, placed.bounds) : placed.bounds;
						placedIds.push(...placed.ids);
					}
				} catch (err) {
					emitError(ctx, `「${file.name}」の取り込みに失敗しました: ${describeError(err)}`);
				}
			}

			// Select once, after the loop: selecting per file would leave only the
			// last PDF's pages selected.
			if (placedIds.length > 0) ctx.store.setSelection(placedIds);

			// Frame once, over everything imported — fitting per file would leave the
			// viewport parked on whichever PDF happened to be last.
			if (fitOnImport && imported) frameImport(ctx, imported);

			if (others.length > 0) {
				await ctx.externalContent.dispatch({ kind: "file", via: content.via, files: others });
			}
		},
	};
}

interface ImportOptions {
	/** Where the grid is centered — vertically always, horizontally unless `left` is set. */
	center: { x: number; y: number };
	/** Left edge of the grid, when it must sit beside an earlier one. */
	left?: number;
	maxSizeMB: number;
	inlineMaxSizeMB: number;
	maxPages: number;
	maxPageWorldSize: number;
	gap: number;
	assets?: AssetStore;
}

interface PlacedPdf {
	/** World bounds of the grid. */
	bounds: BoundingBox;
	/** Ids of the page shapes that were added. */
	ids: string[];
}

/** Import one PDF. Returns what was placed, or null when nothing was. */
async function importPdf(
	file: File,
	ctx: ExternalContentHandlerCtx,
	opts: ImportOptions,
): Promise<PlacedPdf | null> {
	// Pages reference the document by asset id, so without a store there is
	// nowhere to put the bytes — inlining a whole PDF into every page shape
	// would duplicate it once per page.
	if (!opts.assets) {
		emitError(
			ctx,
			"PDFの取り込みにはアセットストアが必要です（@edv4h/usketch-plugin-asset-store を有効にしてください）。",
		);
		return null;
	}

	// The default uploader writes the whole file into the shared Yjs doc as a
	// single update, which large files do not survive (sync message and storage
	// limits). Only allow the larger cap when uploads go somewhere else.
	const limitMB = opts.assets.hasCustomUploader() ? opts.maxSizeMB : opts.inlineMaxSizeMB;
	if (file.size > limitMB * 1024 * 1024) {
		emitError(
			ctx,
			`「${file.name}」は${(file.size / 1024 / 1024).toFixed(1)}MBです。上限は${limitMB}MBです。`,
		);
		return null;
	}

	const dataUrl = await fileToDataUrl(file);

	// Open and measure the local copy *before* uploading. The upload is final
	// — the default store writes into the shared doc, which syncs to every
	// client and has no delete — so a password-protected, corrupt or empty PDF
	// must be turned away first.
	const pendingKey = `pdf-import:pending:${generateId()}`;
	let measured: Awaited<ReturnType<typeof readPageSizes>>;
	try {
		const document = await acquireDocument(pendingKey, dataUrl);
		measured = await readPageSizes(document, opts.maxPages, (page, totalPages) => {
			const payload: PdfImportProgressEvent = { fileName: file.name, page, totalPages };
			ctx.events.emit(PDF_IMPORT_PROGRESS_EVENT, payload);
		});
	} finally {
		releaseDocument(pendingKey);
	}

	if (measured.sizes.length === 0) {
		emitError(ctx, `「${file.name}」から読み取れるページがありませんでした。`);
		return null;
	}

	const assetId = await opts.assets.upload("pdf", dataUrl, {
		mimeType: "application/pdf",
		size: file.size,
	});

	const worldSizes = measured.sizes.map((page) => worldSize(page, opts.maxPageWorldSize));
	let grid = layoutPagesInGrid(worldSizes, { gap: opts.gap, center: opts.center });
	if (opts.left !== undefined) {
		grid = layoutPagesInGrid(worldSizes, {
			gap: opts.gap,
			center: { x: opts.left + grid.width / 2, y: opts.center.y },
		});
	}

	const shapes: PdfPageShapeData[] = [];
	for (const [index, page] of measured.sizes.entries()) {
		const size = worldSizes[index];
		const position = grid.positions[index];
		if (!size || !position) continue;
		shapes.push({
			id: generateId(),
			type: PDF_PAGE_SHAPE_TYPE,
			x: position.x,
			y: position.y,
			width: size.width,
			height: size.height,
			style: pageStyle(),
			assetId,
			pageNumber: page.pageNumber,
			pageCount: measured.totalPages,
			fileName: file.name,
			pointWidth: page.width,
			pointHeight: page.height,
		});
	}

	ctx.commands.execute({
		execute: () => {
			for (const shape of shapes) ctx.store.addShape(shape);
		},
		undo: () => {
			for (const shape of shapes) ctx.store.deleteShape(shape.id);
		},
	});

	if (measured.truncated) {
		// Informational, not a failure: the import itself succeeded.
		ctx.events.emit("ai:status", {
			status: "done",
			message: `「${file.name}」は${measured.totalPages}ページ中、先頭${shapes.length}ページのみ取り込みました。`,
		});
	}

	return {
		bounds: { x: grid.x, y: grid.y, width: grid.width, height: grid.height },
		ids: shapes.map((s) => s.id),
	};
}

/**
 * On-canvas size of a page, derived from its intrinsic PDF points so pages of
 * different paper sizes stay proportional to each other. Never upscales.
 */
function worldSize(page: PdfPageSize, maxPageWorldSize: number): { width: number; height: number } {
	const scale = Math.min(maxPageWorldSize / page.width, maxPageWorldSize / page.height, 1);
	return {
		width: Math.round(page.width * scale),
		height: Math.round(page.height * scale),
	};
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("ファイルを読み込めませんでした"));
		reader.readAsDataURL(file);
	});
}

function union(a: BoundingBox, b: BoundingBox): BoundingBox {
	const x = Math.min(a.x, b.x);
	const y = Math.min(a.y, b.y);
	return {
		x,
		y,
		width: Math.max(a.x + a.width, b.x + b.width) - x,
		height: Math.max(a.y + a.height, b.y + b.height) - y,
	};
}

/**
 * Zoom out far enough to reveal the whole import — a 20-page grid is several
 * times taller than the viewport, so without this the user would paste and see
 * a fragment of one page. Only ever zooms *out*: an import that already fits
 * leaves the viewport exactly where the user put it.
 */
function frameImport(ctx: ExternalContentHandlerCtx, bounds: BoundingBox): void {
	const size = viewportSize();
	if (size.width <= 0 || size.height <= 0) return;
	const { zoom } = ctx.store.getViewport();
	// Same margin `fitToBounds` leaves, so "already fits" and "fit" agree.
	const fitsAlready =
		bounds.width * zoom <= size.width - FIT_PADDING * 2 &&
		bounds.height * zoom <= size.height - FIT_PADDING * 2;
	if (fitsAlready) return;
	ctx.store.fitToBounds(bounds, size, FIT_PADDING);
}

/**
 * Convert the visible screen center to world coordinates. The external-content
 * payload carries no drop point, so handlers place content where the user is
 * currently looking — same strategy as the image plugin.
 */
function viewportCenterToWorld(ctx: ExternalContentHandlerCtx): { x: number; y: number } {
	const vp = ctx.store.getViewport();
	const { width, height } = viewportSize();
	return {
		x: (width / 2 - vp.x) / vp.zoom,
		y: (height / 2 - vp.y) / vp.zoom,
	};
}

function viewportSize(): { width: number; height: number } {
	if (typeof window === "undefined") return { width: 0, height: 0 };
	return { width: window.innerWidth, height: window.innerHeight };
}

/** `ai:status` is the only failure channel hosts subscribe to today. */
function emitError(ctx: ExternalContentHandlerCtx, message: string): void {
	ctx.events.emit("ai:status", { status: "error", message });
}

function describeError(err: unknown): string {
	return explainFailure(err).message;
}
