// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	acquireDocument,
	explainFailure,
	readPageSizes,
	releaseDocument,
	resetDocumentCache,
	setWorkerSrc,
} from "../pdf-document.js";

const mocks = vi.hoisted(() => ({
	getDocument: vi.fn(),
	globalWorkerOptions: { workerSrc: "" },
	version: "6.1.200",
}));

vi.mock("pdfjs-dist", () => ({
	getDocument: mocks.getDocument,
	GlobalWorkerOptions: mocks.globalWorkerOptions,
	version: mocks.version,
}));

function fakeLoadingTask(numPages: number) {
	const destroy = vi.fn(async () => undefined);
	const cleanup = vi.fn();
	const getPage = vi.fn(async () => ({
		getViewport: ({ scale }: { scale: number }) => ({ width: 595 * scale, height: 842 * scale }),
		cleanup,
	}));
	return { task: { promise: Promise.resolve({ numPages, getPage }), destroy }, destroy, cleanup };
}

beforeEach(() => {
	vi.useFakeTimers();
	resetDocumentCache();
	setWorkerSrc(undefined);
	mocks.getDocument.mockReset();
	mocks.globalWorkerOptions.workerSrc = "";
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })),
	);
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("acquireDocument", () => {
	it("opens the document once and shares it across every page that asks", async () => {
		mocks.getDocument.mockReturnValue(fakeLoadingTask(3).task);

		const [a, b] = await Promise.all([
			acquireDocument("asset:1", "data:application/pdf;base64,AAA"),
			acquireDocument("asset:1", "data:application/pdf;base64,AAA"),
		]);

		expect(mocks.getDocument).toHaveBeenCalledTimes(1);
		expect(a).toBe(b);
	});

	it("keeps the document alive while any page still holds it", async () => {
		const { task, destroy } = fakeLoadingTask(3);
		mocks.getDocument.mockReturnValue(task);

		await acquireDocument("asset:1", "src");
		await acquireDocument("asset:1", "src");
		releaseDocument("asset:1");
		await vi.advanceTimersByTimeAsync(10_000);

		expect(destroy).not.toHaveBeenCalled();
	});

	it("tears the document down once the last page lets go", async () => {
		const { task, destroy } = fakeLoadingTask(3);
		mocks.getDocument.mockReturnValue(task);

		await acquireDocument("asset:1", "src");
		releaseDocument("asset:1");
		await vi.advanceTimersByTimeAsync(10_000);

		expect(destroy).toHaveBeenCalledTimes(1);
	});

	it("survives a page being panned out and back in without reopening", async () => {
		const { task, destroy } = fakeLoadingTask(3);
		mocks.getDocument.mockReturnValue(task);

		await acquireDocument("asset:1", "src");
		releaseDocument("asset:1"); // unmounted by viewport LOD
		await vi.advanceTimersByTimeAsync(1_000); // ...and back before the grace period
		await acquireDocument("asset:1", "src");
		await vi.advanceTimersByTimeAsync(10_000);

		expect(destroy).not.toHaveBeenCalled();
		expect(mocks.getDocument).toHaveBeenCalledTimes(1);
	});

	it("does not cache a failed open, so a later retry can succeed", async () => {
		mocks.getDocument.mockReturnValueOnce({
			promise: Promise.reject(Object.assign(new Error("nope"), { name: "InvalidPDFException" })),
			destroy: async () => undefined,
		});

		await expect(acquireDocument("asset:1", "src")).rejects.toThrow(/壊れている/);

		mocks.getDocument.mockReturnValue(fakeLoadingTask(1).task);
		await expect(acquireDocument("asset:1", "src")).resolves.toMatchObject({ numPages: 1 });
	});

	it("surfaces a failed fetch of the asset", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, status: 404 })),
		);

		await expect(acquireDocument("asset:1", "https://example.test/a.pdf")).rejects.toThrow(/404/);
	});
});

describe("worker configuration", () => {
	it("pins the CDN worker to the bundled pdf.js version", async () => {
		mocks.getDocument.mockReturnValue(fakeLoadingTask(1).task);

		await acquireDocument("asset:1", "src");

		expect(mocks.globalWorkerOptions.workerSrc).toBe(
			"https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs",
		);
	});

	it("prefers an explicitly configured worker URL", async () => {
		setWorkerSrc("/pdf.worker.mjs");
		mocks.getDocument.mockReturnValue(fakeLoadingTask(1).task);

		await acquireDocument("asset:1", "src");

		expect(mocks.globalWorkerOptions.workerSrc).toBe("/pdf.worker.mjs");
	});

	it("leaves a worker URL the host already configured untouched", async () => {
		mocks.globalWorkerOptions.workerSrc = "/host-configured.mjs";
		mocks.getDocument.mockReturnValue(fakeLoadingTask(1).task);

		await acquireDocument("asset:1", "src");

		expect(mocks.globalWorkerOptions.workerSrc).toBe("/host-configured.mjs");
	});
});

describe("readPageSizes", () => {
	it("reports each page's intrinsic size in points", async () => {
		const { task, cleanup } = fakeLoadingTask(3);
		mocks.getDocument.mockReturnValue(task);
		const document = await acquireDocument("asset:1", "src");
		const onProgress = vi.fn();

		const result = await readPageSizes(document, 20, onProgress);

		expect(result.sizes).toEqual([
			{ pageNumber: 1, width: 595, height: 842 },
			{ pageNumber: 2, width: 595, height: 842 },
			{ pageNumber: 3, width: 595, height: 842 },
		]);
		expect(result.totalPages).toBe(3);
		expect(result.truncated).toBe(false);
		expect(cleanup).toHaveBeenCalledTimes(3);
		expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3);
	});

	it("stops at the page cap and flags the truncation", async () => {
		mocks.getDocument.mockReturnValue(fakeLoadingTask(10).task);
		const document = await acquireDocument("asset:1", "src");
		const onProgress = vi.fn();

		const result = await readPageSizes(document, 2, onProgress);

		expect(result.sizes).toHaveLength(2);
		expect(result.totalPages).toBe(10);
		expect(result.truncated).toBe(true);
		// Progress counts what will actually be imported.
		expect(onProgress).toHaveBeenLastCalledWith(2, 2);
	});
});

describe("explainFailure", () => {
	it("explains password-protected and corrupt documents in plain language", () => {
		expect(
			explainFailure(Object.assign(new Error("x"), { name: "PasswordException" })).message,
		).toMatch(/パスワード/);
		expect(
			explainFailure(Object.assign(new Error("x"), { name: "InvalidPDFException" })).message,
		).toMatch(/壊れている/);
	});

	it("passes unrecognized errors through unchanged", () => {
		const err = new Error("boom");
		expect(explainFailure(err)).toBe(err);
	});
});
