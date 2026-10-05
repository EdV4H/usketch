// @vitest-environment jsdom
import type { AssetStore } from "@edv4h/usketch-plugin-asset-store";
import type {
	BoardStore,
	CommandRegistry,
	EventBus,
	ExternalContentFile,
	ExternalContentHandlerCtx,
	ExternalContentRegistry,
	ShapeRegistry,
} from "@edv4h/usketch-shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPdfFileHandler } from "../external-content-handler.js";
import type { PdfPageShapeData, PdfPageSize } from "../types.js";

const { acquireDocument, releaseDocument, readPageSizes } = vi.hoisted(() => ({
	acquireDocument: vi.fn(),
	releaseDocument: vi.fn(),
	readPageSizes: vi.fn(),
}));

vi.mock("../pdf-document.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("../pdf-document.js")>()),
	acquireDocument,
	releaseDocument,
	readPageSizes,
}));

/** A4 in PDF points. */
function a4(pageNumber: number): PdfPageSize {
	return { pageNumber, width: 595, height: 842 };
}

function measured(pageCount: number, overrides: Record<string, unknown> = {}) {
	return {
		sizes: Array.from({ length: pageCount }, (_, i) => a4(i + 1)),
		totalPages: pageCount,
		truncated: false,
		...overrides,
	};
}

function makeCtx() {
	const addShape = vi.fn();
	const deleteShape = vi.fn();
	const setSelection = vi.fn();
	const execute = vi.fn((cmd: { execute: () => void }) => cmd.execute());
	const emit = vi.fn();
	const dispatch = vi.fn(async () => true);
	const fitToBounds = vi.fn();

	const store = {
		addShape,
		deleteShape,
		setSelection,
		fitToBounds,
		getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
	} as unknown as BoardStore;

	const ctx: ExternalContentHandlerCtx = {
		store,
		shapes: {} as ShapeRegistry,
		commands: { execute } as unknown as CommandRegistry,
		events: { emit, on: vi.fn(() => () => undefined) } as unknown as EventBus,
		externalContent: { dispatch } as unknown as ExternalContentRegistry,
	};

	return { ctx, addShape, deleteShape, setSelection, execute, emit, dispatch, fitToBounds };
}

function fakeAssets(uploadImpl = vi.fn(async () => "asset:pdf1"), customUploader = false) {
	const store = {
		upload: uploadImpl,
		resolve: vi.fn(() => "data:application/pdf;base64,AAA"),
		hasCustomUploader: () => customUploader,
	} as unknown as AssetStore;
	return { assets: store, upload: uploadImpl };
}

function boundsOf(shapes: PdfPageShapeData[]) {
	const left = Math.min(...shapes.map((s) => s.x));
	const top = Math.min(...shapes.map((s) => s.y));
	return {
		left,
		top,
		right: Math.max(...shapes.map((s) => s.x + s.width)),
		bottom: Math.max(...shapes.map((s) => s.y + s.height)),
	};
}

function pdfFile(name = "report.pdf", type = "application/pdf", size = 1024): File {
	return new File([new Uint8Array(size)], name, { type });
}

function imageFile(name = "photo.png"): File {
	return new File([new Uint8Array(10)], name, { type: "image/png" });
}

function fileContent(files: File[]): ExternalContentFile {
	return { kind: "file", via: "paste", files };
}

function statusMessages(emit: ReturnType<typeof vi.fn>): string[] {
	return emit.mock.calls
		.filter(([event]) => event === "ai:status")
		.map(([, payload]) => (payload as { message?: string }).message ?? "");
}

function placedShapes(addShape: ReturnType<typeof vi.fn>): PdfPageShapeData[] {
	return addShape.mock.calls.map(([s]) => s as PdfPageShapeData);
}

beforeEach(() => {
	acquireDocument.mockReset().mockResolvedValue({ numPages: 3 });
	releaseDocument.mockReset();
	readPageSizes.mockReset().mockResolvedValue(measured(3));
});

describe("createPdfFileHandler / match", () => {
	it("matches when any file is a PDF by MIME type", () => {
		const h = createPdfFileHandler();
		const { ctx } = makeCtx();
		expect(h.match(fileContent([pdfFile()]), ctx)).toBe(true);
		expect(h.match(fileContent([imageFile(), pdfFile()]), ctx)).toBe(true);
	});

	it("matches a PDF whose MIME type is missing, by file extension", () => {
		const h = createPdfFileHandler();
		const { ctx } = makeCtx();
		expect(h.match(fileContent([pdfFile("Report.PDF", "")]), ctx)).toBe(true);
	});

	it("does not match payloads without a PDF", () => {
		const h = createPdfFileHandler();
		const { ctx } = makeCtx();
		expect(h.match(fileContent([imageFile()]), ctx)).toBe(false);
		expect(h.match(fileContent([]), ctx)).toBe(false);
	});

	it("defaults to order 0 and propagates the option", () => {
		expect(createPdfFileHandler().order).toBe(0);
		expect(createPdfFileHandler({ order: 50 }).order).toBe(50);
	});
});

describe("createPdfFileHandler / handle", () => {
	it("stores the document once and references it from every page", async () => {
		const { assets, upload } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, addShape } = makeCtx();

		await h.handle(fileContent([pdfFile()]), ctx);

		// One upload for a 3-page document — not one per page.
		expect(upload).toHaveBeenCalledTimes(1);
		expect(upload).toHaveBeenCalledWith(
			"pdf",
			expect.stringContaining("application/pdf"),
			expect.objectContaining({ mimeType: "application/pdf" }),
		);
		const shapes = placedShapes(addShape);
		expect(shapes).toHaveLength(3);
		expect(shapes.every((s) => s.assetId === "asset:pdf1")).toBe(true);
		expect(shapes.map((s) => s.pageNumber)).toEqual([1, 2, 3]);
	});

	it("places live page shapes, not rasterized images", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, addShape } = makeCtx();

		await h.handle(fileContent([pdfFile()]), ctx);

		const shape = placedShapes(addShape)[0];
		expect(shape?.type).toBe("pdf-page");
		// The page carries its intrinsic geometry so its aspect is known before
		// the document finishes loading.
		expect(shape?.pointWidth).toBe(595);
		expect(shape?.pointHeight).toBe(842);
		expect(shape).not.toHaveProperty("src");
	});

	it("adds every page in a single undoable command", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, addShape, deleteShape, execute, setSelection } = makeCtx();

		await h.handle(fileContent([pdfFile()]), ctx);

		expect(execute).toHaveBeenCalledTimes(1);
		expect(setSelection).toHaveBeenCalledWith(placedShapes(addShape).map((s) => s.id));

		const command = execute.mock.calls[0]?.[0] as { undo: () => void };
		command.undo();
		expect(deleteShape).toHaveBeenCalledTimes(3);
	});

	it("scales pages to `maxPageWorldSize` on their longest side", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({ maxPageWorldSize: 480 }, () => assets);
		const { ctx, addShape } = makeCtx();

		await h.handle(fileContent([pdfFile()]), ctx);

		const shape = placedShapes(addShape)[0];
		expect(shape?.height).toBe(480);
		expect(shape?.width).toBe(339);
	});

	it("lays pages out on a grid rather than stacking them", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, addShape } = makeCtx();

		await h.handle(fileContent([pdfFile()]), ctx);

		const positions = placedShapes(addShape).map((s) => `${s.x},${s.y}`);
		expect(new Set(positions).size).toBe(3);
	});

	it("releases the document it opened for measuring", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx } = makeCtx();

		await h.handle(fileContent([pdfFile()]), ctx);

		expect(acquireDocument).toHaveBeenCalledTimes(1);
		expect(releaseDocument).toHaveBeenCalledTimes(1);
		expect(releaseDocument).toHaveBeenCalledWith(acquireDocument.mock.calls[0]?.[0]);
	});

	it("measures the local copy first and uploads only once the PDF has opened", async () => {
		const order: string[] = [];
		const upload = vi.fn(async () => {
			order.push("upload");
			return "asset:pdf1";
		});
		const { assets } = fakeAssets(upload);
		acquireDocument.mockImplementation(async (_key: string, src: string) => {
			order.push("open");
			// The bytes come from the file itself, not from the asset store.
			expect(src).toMatch(/^data:application\/pdf/);
			return { numPages: 3 };
		});
		readPageSizes.mockImplementation(async () => {
			order.push("measure");
			return measured(3);
		});
		const h = createPdfFileHandler({}, () => assets);
		const { ctx } = makeCtx();

		await h.handle(fileContent([pdfFile()]), ctx);

		expect(order).toEqual(["open", "measure", "upload"]);
	});

	it("selects every imported page once, across all PDFs in the payload", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, addShape, setSelection } = makeCtx();

		await h.handle(fileContent([pdfFile("a.pdf"), pdfFile("b.pdf")]), ctx);

		expect(setSelection).toHaveBeenCalledTimes(1);
		expect(setSelection).toHaveBeenCalledWith(placedShapes(addShape).map((s) => s.id));
		expect(placedShapes(addShape)).toHaveLength(6);
	});

	it("places PDFs of different page counts side by side without overlap", async () => {
		// The review's case: a 1-page PDF then a 9-page one. Centering each grid
		// at "previous center + previous width" overlapped them by a full page.
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, addShape } = makeCtx();
		readPageSizes.mockResolvedValueOnce(measured(1)).mockResolvedValueOnce(measured(9));

		await h.handle(fileContent([pdfFile("one.pdf"), pdfFile("nine.pdf")]), ctx);

		const shapes = placedShapes(addShape);
		const first = boundsOf(shapes.filter((s) => s.fileName === "one.pdf"));
		const second = boundsOf(shapes.filter((s) => s.fileName === "nine.pdf"));
		expect(second.left).toBeGreaterThanOrEqual(first.right + 24);
		// Both stay vertically centered on the same line.
		expect((first.top + first.bottom) / 2).toBeCloseTo((second.top + second.bottom) / 2, 0);
	});

	it("emits a progress event per page", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, emit } = makeCtx();
		readPageSizes.mockImplementation(
			async (_doc: unknown, _max: number, onProgress?: (p: number, t: number) => void) => {
				onProgress?.(1, 3);
				onProgress?.(2, 3);
				return measured(3);
			},
		);

		await h.handle(fileContent([pdfFile()]), ctx);

		const progress = emit.mock.calls.filter(([event]) => event === "pdf-import:progress");
		expect(progress).toHaveLength(2);
		expect(progress[0]?.[1]).toEqual({ fileName: "report.pdf", page: 1, totalPages: 3 });
	});

	it("re-dispatches non-PDF files so their own handler can claim them", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, dispatch } = makeCtx();
		const image = imageFile();

		await h.handle(fileContent([pdfFile(), image]), ctx);

		expect(dispatch).toHaveBeenCalledWith({ kind: "file", via: "paste", files: [image] });
	});

	it("does not re-dispatch when the payload is PDFs only", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, dispatch } = makeCtx();

		await h.handle(fileContent([pdfFile()]), ctx);

		expect(dispatch).not.toHaveBeenCalled();
	});
});

describe("createPdfFileHandler / framing the import", () => {
	// jsdom's window is 1024x768, so a 2x2 grid of A4 pages overflows it.
	it("zooms out to reveal the whole grid when it overflows the viewport", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, fitToBounds } = makeCtx();

		await h.handle(fileContent([pdfFile()]), ctx);

		expect(fitToBounds).toHaveBeenCalledTimes(1);
		expect(fitToBounds.mock.calls[0]?.[1]).toEqual({
			width: window.innerWidth,
			height: window.innerHeight,
		});
	});

	it("leaves the viewport alone when the import already fits", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({ maxPageWorldSize: 100 }, () => assets);
		const { ctx, fitToBounds } = makeCtx();
		readPageSizes.mockResolvedValue(measured(1));

		await h.handle(fileContent([pdfFile()]), ctx);

		expect(fitToBounds).not.toHaveBeenCalled();
	});

	it("frames every imported PDF at once rather than jumping to the last one", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, fitToBounds, addShape } = makeCtx();

		await h.handle(fileContent([pdfFile("a.pdf"), pdfFile("b.pdf")]), ctx);

		expect(fitToBounds).toHaveBeenCalledTimes(1);
		const bounds = fitToBounds.mock.calls[0]?.[0] as { x: number; width: number };
		const xs = placedShapes(addShape).map((s) => s.x);
		expect(bounds.x).toBeLessThanOrEqual(Math.min(...xs));
		expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(Math.max(...xs));
	});

	it("can be turned off", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({ fitOnImport: false }, () => assets);
		const { ctx, fitToBounds } = makeCtx();

		await h.handle(fileContent([pdfFile()]), ctx);

		expect(fitToBounds).not.toHaveBeenCalled();
	});
});

describe("createPdfFileHandler / failures", () => {
	it("explains that an asset store is required", async () => {
		const h = createPdfFileHandler();
		const { ctx, addShape, emit } = makeCtx();

		await h.handle(fileContent([pdfFile()]), ctx);

		expect(addShape).not.toHaveBeenCalled();
		expect(statusMessages(emit).join()).toContain("アセットストア");
	});

	it("rejects oversized PDFs without uploading them", async () => {
		const { assets, upload } = fakeAssets(undefined, true);
		const h = createPdfFileHandler({ maxSizeMB: 1 }, () => assets);
		const { ctx, addShape, emit } = makeCtx();

		await h.handle(fileContent([pdfFile("big.pdf", "application/pdf", 2 * 1024 * 1024)]), ctx);

		expect(upload).not.toHaveBeenCalled();
		expect(addShape).not.toHaveBeenCalled();
		expect(statusMessages(emit).join()).toContain("big.pdf");
	});

	it("caps PDFs at the inline limit while the asset store writes into the shared doc", async () => {
		const { assets, upload } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, addShape, emit } = makeCtx();

		await h.handle(fileContent([pdfFile("big.pdf", "application/pdf", 5 * 1024 * 1024)]), ctx);

		expect(upload).not.toHaveBeenCalled();
		expect(addShape).not.toHaveBeenCalled();
		expect(statusMessages(emit).join()).toContain("上限は4MB");
	});

	it("allows the larger limit once uploads go to a custom uploader", async () => {
		const { assets, upload } = fakeAssets(undefined, true);
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, addShape } = makeCtx();

		await h.handle(fileContent([pdfFile("big.pdf", "application/pdf", 5 * 1024 * 1024)]), ctx);

		expect(upload).toHaveBeenCalledTimes(1);
		expect(addShape).toHaveBeenCalled();
	});

	it("does not upload a PDF that fails to open", async () => {
		const { assets, upload } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx } = makeCtx();
		acquireDocument.mockRejectedValue(new Error("パスワード付きPDFのため読み込めません"));

		await h.handle(fileContent([pdfFile()]), ctx);

		// The default store writes into the synced doc and cannot delete, so an
		// upload here would leak the bytes to every client for good.
		expect(upload).not.toHaveBeenCalled();
		expect(releaseDocument).toHaveBeenCalledTimes(1);
	});

	it("reports a load failure instead of throwing out of the dispatch", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, emit } = makeCtx();
		acquireDocument.mockRejectedValue(new Error("パスワード付きPDFのため読み込めません"));

		await expect(h.handle(fileContent([pdfFile()]), ctx)).resolves.toBeUndefined();
		expect(statusMessages(emit).join()).toContain("パスワード");
	});

	it("keeps importing the remaining PDFs after one fails", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, execute } = makeCtx();
		acquireDocument.mockRejectedValueOnce(new Error("broken")).mockResolvedValue({ numPages: 2 });
		readPageSizes.mockResolvedValue(measured(2));

		await h.handle(fileContent([pdfFile("bad.pdf"), pdfFile("good.pdf")]), ctx);

		expect(execute).toHaveBeenCalledTimes(1);
	});

	it("still re-dispatches other files when the PDF fails", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, dispatch } = makeCtx();
		acquireDocument.mockRejectedValue(new Error("broken"));

		await h.handle(fileContent([pdfFile(), imageFile()]), ctx);

		expect(dispatch).toHaveBeenCalledTimes(1);
	});

	it("warns when the page cap truncated the import", async () => {
		const { assets } = fakeAssets();
		const h = createPdfFileHandler({ maxPages: 2 }, () => assets);
		const { ctx, addShape, emit } = makeCtx();
		readPageSizes.mockResolvedValue(measured(2, { totalPages: 9, truncated: true }));

		await h.handle(fileContent([pdfFile()]), ctx);

		expect(addShape).toHaveBeenCalledTimes(2);
		const message = statusMessages(emit).join();
		expect(message).toContain("9");
		expect(message).toContain("2");
		// The import succeeded; truncation is a notice, not an error.
		const statuses = emit.mock.calls
			.filter(([event]) => event === "ai:status")
			.map(([, payload]) => (payload as { status: string }).status);
		expect(statuses).toEqual(["done"]);
	});

	it("reports a document with no readable pages", async () => {
		const { assets, upload } = fakeAssets();
		const h = createPdfFileHandler({}, () => assets);
		const { ctx, addShape, execute, emit } = makeCtx();
		readPageSizes.mockResolvedValue(measured(0));

		await h.handle(fileContent([pdfFile()]), ctx);

		expect(upload).not.toHaveBeenCalled();
		expect(addShape).not.toHaveBeenCalled();
		expect(execute).not.toHaveBeenCalled();
		expect(statusMessages(emit)).toHaveLength(1);
	});
});
