// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	acquireDocument,
	explainFailure,
	readPageSizes,
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
	setWorkerSrc("/pdf.worker.mjs");
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
			acquireDocument("asset:1", "data:application/pdf;base64,AAA").document,
			acquireDocument("asset:1", "data:application/pdf;base64,AAA").document,
		]);

		expect(mocks.getDocument).toHaveBeenCalledTimes(1);
		expect(a).toBe(b);
	});

	it("keeps the document alive while any page still holds it", async () => {
		const { task, destroy } = fakeLoadingTask(3);
		mocks.getDocument.mockReturnValue(task);

		const first = acquireDocument("asset:1", "src");
		acquireDocument("asset:1", "src");
		await first.document;
		first.release();
		first.release(); // idempotent: must not drop the other holder's reference
		await vi.advanceTimersByTimeAsync(10_000);

		expect(destroy).not.toHaveBeenCalled();
	});

	it("tears the document down once the last page lets go", async () => {
		const { task, destroy } = fakeLoadingTask(3);
		mocks.getDocument.mockReturnValue(task);

		const lease = acquireDocument("asset:1", "src");
		await lease.document;
		lease.release();
		await vi.advanceTimersByTimeAsync(10_000);

		expect(destroy).toHaveBeenCalledTimes(1);
	});

	it("survives a page being panned out and back in without reopening", async () => {
		const { task, destroy } = fakeLoadingTask(3);
		mocks.getDocument.mockReturnValue(task);

		const out = acquireDocument("asset:1", "src");
		await out.document;
		out.release(); // unmounted by viewport LOD
		await vi.advanceTimersByTimeAsync(1_000); // ...and back before the grace period
		await acquireDocument("asset:1", "src").document;
		await vi.advanceTimersByTimeAsync(10_000);

		expect(destroy).not.toHaveBeenCalled();
		expect(mocks.getDocument).toHaveBeenCalledTimes(1);
	});

	it("restarts the grace period when a page leaves again after coming back", async () => {
		const { task, destroy } = fakeLoadingTask(1);
		mocks.getDocument.mockReturnValue(task);

		const first = acquireDocument("asset:1", "src");
		await first.document;
		first.release();
		await vi.advanceTimersByTimeAsync(4_000);
		const second = acquireDocument("asset:1", "src");
		second.release();
		// The first release's timer would have fired here had it not been cleared.
		await vi.advanceTimersByTimeAsync(2_000);
		expect(destroy).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(4_000);
		expect(destroy).toHaveBeenCalledTimes(1);
	});

	it("does not let a holder of a failed open release someone else's document", async () => {
		mocks.getDocument.mockReturnValueOnce({
			promise: Promise.reject(Object.assign(new Error("nope"), { name: "InvalidPDFException" })),
			destroy: vi.fn(async () => undefined),
		});
		const failed = acquireDocument("asset:1", "src");
		await expect(failed.document).rejects.toThrow(/壊れている/);

		const { task, destroy } = fakeLoadingTask(1);
		mocks.getDocument.mockReturnValue(task);
		const retried = acquireDocument("asset:1", "src");
		await retried.document;
		failed.release(); // e.g. the shape that saw the error unmounts
		await vi.advanceTimersByTimeAsync(10_000);

		expect(destroy).not.toHaveBeenCalled();
		await expect(acquireDocument("asset:1", "src").document).resolves.toBe(await retried.document);
		expect(mocks.getDocument).toHaveBeenCalledTimes(2);
	});

	it("hands a measured document over to its asset id without reopening it", async () => {
		mocks.getDocument.mockReturnValue(fakeLoadingTask(2).task);

		const pending = acquireDocument("pending:1", "data:local");
		const measured = await pending.document;
		pending.rekey("asset:1");
		pending.release();

		await expect(acquireDocument("asset:1", "data:uploaded").document).resolves.toBe(measured);
		expect(mocks.getDocument).toHaveBeenCalledTimes(1);
	});

	it("keeps the cached document when the asset id is already open", async () => {
		const existing = fakeLoadingTask(2);
		mocks.getDocument.mockReturnValueOnce(existing.task);
		const onBoard = await acquireDocument("asset:1", "src").document;

		const reimport = fakeLoadingTask(2);
		mocks.getDocument.mockReturnValueOnce(reimport.task);
		const pending = acquireDocument("pending:1", "src");
		await pending.document;
		pending.rekey("asset:1");
		pending.release();
		await vi.advanceTimersByTimeAsync(10_000);

		await expect(acquireDocument("asset:1", "src").document).resolves.toBe(onBoard);
		expect(reimport.destroy).toHaveBeenCalledTimes(1);
		expect(existing.destroy).not.toHaveBeenCalled();
	});

	it("does not cache a failed open, so a later retry can succeed", async () => {
		const destroy = vi.fn(async () => undefined);
		mocks.getDocument.mockReturnValueOnce({
			promise: Promise.reject(Object.assign(new Error("nope"), { name: "InvalidPDFException" })),
			destroy,
		});

		await expect(acquireDocument("asset:1", "src").document).rejects.toThrow(/壊れている/);
		// Nobody else holds the failed task, so it must be destroyed here or its
		// worker-side state leaks (e.g. a PasswordException keeps it alive).
		expect(destroy).toHaveBeenCalledTimes(1);

		mocks.getDocument.mockReturnValue(fakeLoadingTask(1).task);
		await expect(acquireDocument("asset:1", "src").document).resolves.toMatchObject({
			numPages: 1,
		});
	});

	it("surfaces a failed fetch of the asset", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, status: 404 })),
		);

		await expect(acquireDocument("asset:1", "https://example.test/a.pdf").document).rejects.toThrow(
			/404/,
		);
	});
});

describe("worker configuration", () => {
	it("refuses to start without a worker URL instead of fetching one from a CDN", async () => {
		setWorkerSrc(undefined);
		mocks.getDocument.mockReturnValue(fakeLoadingTask(1).task);

		await expect(acquireDocument("asset:1", "src").document).rejects.toThrow(/workerSrc/);
		expect(mocks.globalWorkerOptions.workerSrc).toBe("");
		expect(mocks.getDocument).not.toHaveBeenCalled();
	});

	it("prefers an explicitly configured worker URL", async () => {
		mocks.getDocument.mockReturnValue(fakeLoadingTask(1).task);

		await acquireDocument("asset:1", "src").document;

		expect(mocks.globalWorkerOptions.workerSrc).toBe("/pdf.worker.mjs");
	});

	it("leaves a worker URL the host already configured untouched", async () => {
		setWorkerSrc(undefined);
		mocks.globalWorkerOptions.workerSrc = "/host-configured.mjs";
		mocks.getDocument.mockReturnValue(fakeLoadingTask(1).task);

		await acquireDocument("asset:1", "src").document;

		expect(mocks.globalWorkerOptions.workerSrc).toBe("/host-configured.mjs");
	});
});

describe("readPageSizes", () => {
	it("reports each page's intrinsic size in points", async () => {
		const { task, cleanup } = fakeLoadingTask(3);
		mocks.getDocument.mockReturnValue(task);
		const document = await acquireDocument("asset:1", "src").document;
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
		const document = await acquireDocument("asset:1", "src").document;
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
