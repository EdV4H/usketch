import type { AssetStore } from "@edv4h/usketch-plugin-asset-store";
import type {
	BoundingBox,
	ExternalContentHandler,
	ExternalContentHandlerCtx,
	ShapeData,
} from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { layoutPagesInGrid } from "./layout.js";
import { acquireDocument, explainFailure, readPageSizes, releaseDocument } from "./pdf-document.js";
import { PAGE_STYLE } from "./pdf-page-shape.js";
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

const DEFAULTS = {
	maxSizeMB: 50,
	maxPages: 50,
	maxPageWorldSize: 480,
	gap: 24,
	order: 0,
} as const;

/**
 * Screen-pixel margin left around an auto-fitted import. Wider than the store's
 * 40px default so the grid toolbar — anchored above the pages, which land
 * selected — has room to sit instead of being clamped over the first row.
 */
const FIT_PADDING = 96;

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
		maxSizeMB = DEFAULTS.maxSizeMB,
		maxPages = DEFAULTS.maxPages,
		maxPageWorldSize = DEFAULTS.maxPageWorldSize,
		gap = DEFAULTS.gap,
		order = DEFAULTS.order,
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
			let offsetX = 0;
			let imported: BoundingBox | null = null;

			for (const file of pdfs) {
				// One PDF must never abort the rest of the batch: the registry runs a
				// single winning handler, so a throw here would silently drop every
				// remaining file, including the non-PDF remainder below.
				try {
					const placed = await importPdf(file, ctx, {
						center: { x: origin.x + offsetX, y: origin.y },
						maxSizeMB,
						maxPages,
						maxPageWorldSize,
						gap,
						assets: getAssets?.(),
					});
					if (placed) {
						offsetX += placed.width + gap;
						imported = imported ? union(imported, placed) : placed;
					}
				} catch (err) {
					emitError(ctx, `「${file.name}」の取り込みに失敗しました: ${describeError(err)}`);
				}
			}

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
	center: { x: number; y: number };
	maxSizeMB: number;
	maxPages: number;
	maxPageWorldSize: number;
	gap: number;
	assets?: AssetStore;
}

/** Import one PDF. Returns the grid's world bounds, or null when nothing was placed. */
async function importPdf(
	file: File,
	ctx: ExternalContentHandlerCtx,
	opts: ImportOptions,
): Promise<BoundingBox | null> {
	if (file.size > opts.maxSizeMB * 1024 * 1024) {
		emitError(
			ctx,
			`「${file.name}」は${(file.size / 1024 / 1024).toFixed(1)}MBです。上限は${opts.maxSizeMB}MBです。`,
		);
		return null;
	}

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

	const dataUrl = await fileToDataUrl(file);
	const assetId = await opts.assets.upload("pdf", dataUrl, {
		mimeType: "application/pdf",
		size: file.size,
	});

	// Read page geometry through the same shared cache the shapes will use, so
	// the document is parsed once and is already warm when they mount.
	const source = opts.assets.resolve(assetId) ?? dataUrl;
	const document = await acquireDocument(assetId, source);
	let measured: Awaited<ReturnType<typeof readPageSizes>>;
	try {
		measured = await readPageSizes(document, opts.maxPages, (page, totalPages) => {
			const payload: PdfImportProgressEvent = { fileName: file.name, page, totalPages };
			ctx.events.emit(PDF_IMPORT_PROGRESS_EVENT, payload);
		});
	} finally {
		releaseDocument(assetId);
	}

	if (measured.sizes.length === 0) {
		emitError(ctx, `「${file.name}」から読み取れるページがありませんでした。`);
		return null;
	}

	const worldSizes = measured.sizes.map((page) => worldSize(page, opts.maxPageWorldSize));
	const grid = layoutPagesInGrid(worldSizes, { gap: opts.gap, center: opts.center });

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
			style: { ...PAGE_STYLE },
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
	ctx.store.setSelection(shapes.map((s) => s.id));

	if (measured.truncated) {
		emitError(
			ctx,
			`「${file.name}」は${measured.totalPages}ページ中、先頭${shapes.length}ページのみ取り込みました。`,
		);
	}

	return { x: grid.x, y: grid.y, width: grid.width, height: grid.height };
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
	const fitsAlready = bounds.width * zoom <= size.width && bounds.height * zoom <= size.height;
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

/** Re-exported for tests that build page shapes by hand. */
export type { ShapeData };
