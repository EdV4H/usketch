import type { AssetStore } from "@edv4h/usketch-plugin-asset-store";
import {
	type BoundingBox,
	centerOnWorld,
	type ExternalContentFile,
	type ExternalContentHandler,
	type ExternalContentHandlerCtx,
	generateId,
	getScreenSize,
	getShapeAABB,
	screenCenterWorld,
	worldToScreen,
} from "@edv4h/usketch-shared";
import { layoutPagesInGrid } from "./layout.js";
import {
	acquireDocument,
	type DocumentLease,
	explainFailure,
	readPageSizes,
} from "./pdf-document.js";
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

			// Hand the rest of the payload to its own handlers first. They have no
			// drop point either and put what they make at the screen center, so the
			// PDFs go beside whatever they placed rather than underneath it.
			const other = others.length > 0 ? await dispatchOthers(ctx, content.via, others) : null;

			// Grids differ in width, so each one is placed by its left edge, just
			// right of the previous one, top-aligned with it. Only a first grid
			// with nothing beside it is centered on the view.
			let anchor = other
				? { left: other.bounds.x + other.bounds.width + gap, top: other.bounds.y }
				: undefined;
			const center = screenCenterWorld(ctx.store);
			const placed: PlacedPdf[] = [];

			try {
				for (const file of pdfs) {
					// One PDF must never abort the rest of the batch: the registry runs
					// a single winning handler, so a throw here would silently drop
					// every remaining file.
					try {
						const pdf = await importPdf(file, ctx, {
							center,
							anchor,
							maxSizeMB,
							maxPages,
							maxPageWorldSize,
							gap,
							assets: getAssets?.(),
						});
						if (pdf) {
							placed.push(pdf);
							anchor = { left: pdf.bounds.x + pdf.bounds.width + gap, top: pdf.bounds.y };
						}
					} catch (err) {
						emitError(ctx, `「${file.name}」の取り込みに失敗しました: ${describeError(err)}`);
					}
				}

				const shapes = placed.flatMap((pdf) => pdf.shapes);
				if (shapes.length > 0) {
					// One command for the whole drop, so a single undo takes back every
					// PDF in it.
					ctx.commands.execute({
						execute: () => {
							for (const shape of shapes) ctx.store.addShape(shape);
						},
						undo: () => {
							for (const shape of shapes) ctx.store.deleteShape(shape.id);
						},
					});
				}
			} finally {
				// Held until the pages exist, so they mount onto the already-parsed
				// document instead of fetching and parsing it again.
				for (const pdf of placed) pdf.lease.release();
			}

			const pdfIds = placed.flatMap((pdf) => pdf.shapes.map((shape) => shape.id));
			if (pdfIds.length === 0) return;

			// Select and frame once, over everything this drop produced — doing it
			// per file would leave only the last PDF selected and in view.
			ctx.store.setSelection([...(other?.ids ?? []), ...pdfIds]);
			if (fitOnImport) {
				const bounds = placed.map((pdf) => pdf.bounds).reduce(union);
				frameImport(ctx, other ? union(other.bounds, bounds) : bounds);
			}
		},
	};
}

/** What the re-dispatched remainder of the payload put on the board. */
interface OtherContent {
	bounds: BoundingBox;
	ids: string[];
}

/**
 * Re-dispatch the non-PDF files and report what their handlers added, measured
 * as the store's shapes before and after — so it works whichever handler (image
 * or third-party) claims them.
 */
async function dispatchOthers(
	ctx: ExternalContentHandlerCtx,
	via: ExternalContentFile["via"],
	files: File[],
): Promise<OtherContent | null> {
	const before = new Set(ctx.store.getShapes().keys());
	await ctx.externalContent.dispatch({ kind: "file", via, files });
	const added = [...ctx.store.getShapes().values()].filter((shape) => !before.has(shape.id));
	if (added.length === 0) return null;
	return {
		bounds: added.map(getShapeAABB).reduce(union),
		ids: added.map((shape) => shape.id),
	};
}

interface ImportOptions {
	/** Where the grid is centered, unless `anchor` is set. */
	center: { x: number; y: number };
	/** Top-left corner of the grid, when it must sit beside earlier content. */
	anchor?: { left: number; top: number };
	maxSizeMB: number;
	maxPages: number;
	maxPageWorldSize: number;
	gap: number;
	assets?: AssetStore;
}

interface PlacedPdf {
	/** World bounds of the grid. */
	bounds: BoundingBox;
	/** Page shapes to add. */
	shapes: PdfPageShapeData[];
	/** The measured document, already filed under its asset id. Release once the pages exist. */
	lease: DocumentLease;
}

/** Prepare one PDF's pages. Returns null when there is nothing to place. */
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

	// The store knows how large a payload its uploader can take (the default
	// one writes into the shared doc, which large files do not survive).
	const limitBytes = Math.min(
		opts.maxSizeMB * 1024 * 1024,
		opts.assets.maxUploadBytes() ?? Number.POSITIVE_INFINITY,
	);
	if (file.size > limitBytes) {
		emitError(ctx, `「${file.name}」は${toMB(file.size)}MBです。上限は${toMB(limitBytes)}MBです。`);
		return null;
	}

	const dataUrl = await fileToDataUrl(file);

	// Open and measure the local copy *before* uploading. The upload is final
	// — the default store writes into the shared doc, which syncs to every
	// client and has no delete — so a password-protected, corrupt or empty PDF
	// must be turned away first.
	const lease = acquireDocument(`pdf-import:pending:${generateId()}`, dataUrl);
	let handedOver = false;
	try {
		const measured = await readPageSizes(
			await lease.document,
			opts.maxPages,
			(page, totalPages) => {
				const payload: PdfImportProgressEvent = { fileName: file.name, page, totalPages };
				ctx.events.emit(PDF_IMPORT_PROGRESS_EVENT, payload);
			},
		);

		if (measured.sizes.length === 0) {
			emitError(ctx, `「${file.name}」から読み取れるページがありませんでした。`);
			return null;
		}

		const assetId = await opts.assets.upload("pdf", dataUrl, {
			mimeType: "application/pdf",
			size: file.size,
		});
		// The pages will ask for the document by asset id; give them this one.
		lease.rekey(assetId);

		const worldSizes = measured.sizes.map((page) => worldSize(page, opts.maxPageWorldSize));
		const grid = layoutPagesInGrid(worldSizes, { gap: opts.gap, center: { x: 0, y: 0 } });
		// Lay out once around the origin, then move the finished grid into place.
		const dx = Math.round(opts.anchor ? opts.anchor.left - grid.x : opts.center.x);
		const dy = Math.round(opts.anchor ? opts.anchor.top - grid.y : opts.center.y);

		const shapes: PdfPageShapeData[] = [];
		for (const [index, page] of measured.sizes.entries()) {
			const size = worldSizes[index];
			const position = grid.positions[index];
			if (!size || !position) continue;
			shapes.push({
				id: generateId(),
				type: PDF_PAGE_SHAPE_TYPE,
				x: position.x + dx,
				y: position.y + dy,
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

		if (measured.truncated) {
			// Informational, not a failure: the import itself succeeded.
			ctx.events.emit("ai:status", {
				status: "done",
				message: `「${file.name}」は${measured.totalPages}ページ中、先頭${shapes.length}ページのみ取り込みました。`,
			});
		}

		handedOver = true;
		return {
			bounds: { x: grid.x + dx, y: grid.y + dy, width: grid.width, height: grid.height },
			shapes,
			lease,
		};
	} finally {
		if (!handedOver) lease.release();
	}
}

/** Megabytes to one decimal place, without a trailing ".0". */
function toMB(bytes: number): number {
	return Number((bytes / 1024 / 1024).toFixed(1));
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
 * Bring the whole import into view — a 20-page grid is several times taller
 * than the viewport, so without this the user would paste and see a fragment
 * of one page. Never zooms *in*: an import that is already on screen leaves the
 * viewport exactly where the user put it, and one that is off screen but would
 * fit at the current zoom is only panned to.
 */
function frameImport(ctx: ExternalContentHandlerCtx, bounds: BoundingBox): void {
	const size = getScreenSize();
	if (size.width <= 0 || size.height <= 0) return;
	// Where the import's corners land on screen; under a rotated viewport the
	// on-screen footprint is not simply the world size times the zoom.
	const corners = [
		[bounds.x, bounds.y],
		[bounds.x + bounds.width, bounds.y],
		[bounds.x, bounds.y + bounds.height],
		[bounds.x + bounds.width, bounds.y + bounds.height],
	].map(([x = 0, y = 0]) => worldToScreen(x, y, ctx.store.getViewport()));
	const xs = corners.map((p) => p.x);
	const ys = corners.map((p) => p.y);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);
	const minY = Math.min(...ys);
	const maxY = Math.max(...ys);

	// Same margin `fitToBounds` leaves, so "already in view" and "fit" agree.
	const onScreen =
		minX >= FIT_PADDING &&
		minY >= FIT_PADDING &&
		maxX <= size.width - FIT_PADDING &&
		maxY <= size.height - FIT_PADDING;
	if (onScreen) return;

	const fitsAtThisZoom =
		maxX - minX <= size.width - FIT_PADDING * 2 && maxY - minY <= size.height - FIT_PADDING * 2;
	if (fitsAtThisZoom) {
		centerOnWorld(ctx.store, {
			x: bounds.x + bounds.width / 2,
			y: bounds.y + bounds.height / 2,
		});
		return;
	}
	ctx.store.fitToBounds(bounds, size, FIT_PADDING);
}

/** `ai:status` is the only failure channel hosts subscribe to today. */
function emitError(ctx: ExternalContentHandlerCtx, message: string): void {
	ctx.events.emit("ai:status", { status: "error", message });
}

function describeError(err: unknown): string {
	return explainFailure(err).message;
}
