// @vitest-environment jsdom
import type { PDFDocumentProxy } from "pdfjs-dist";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cachedPixelCount, getCachedPage, renderPage, resetPageCache } from "../page-renderer.js";

/** A4-shaped fake document whose pages render instantly. */
function fakeDocument(): { document: PDFDocumentProxy; getPage: ReturnType<typeof vi.fn> } {
	const getPage = vi.fn(async () => ({
		getViewport: ({ scale }: { scale: number }) => ({ width: 595 * scale, height: 842 * scale }),
		render: () => ({ promise: Promise.resolve() }),
		cleanup: vi.fn(),
	}));
	return { document: { getPage } as unknown as PDFDocumentProxy, getPage };
}

function render(document: PDFDocumentProxy, width: number, pageNumber = 1) {
	return renderPage({
		documentKey: "asset:a",
		document,
		pageNumber,
		width,
		signal: new AbortController().signal,
	});
}

beforeEach(() => {
	resetPageCache();
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
		{} as unknown as CanvasRenderingContext2D,
	);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("renderPage caching", () => {
	it("serves a repeat request for the same size from cache", async () => {
		const { document, getPage } = fakeDocument();

		const first = await render(document, 256);
		const second = await render(document, 256);

		expect(second).toBe(first);
		expect(getPage).toHaveBeenCalledTimes(1);
	});

	it("re-renders when the needed resolution changes", async () => {
		const { document, getPage } = fakeDocument();

		await render(document, 256);
		await render(document, 1024);

		expect(getPage).toHaveBeenCalledTimes(2);
		expect(getCachedPage("asset:a", 1, 256)).toBeDefined();
		expect(getCachedPage("asset:a", 1, 1024)).toBeDefined();
	});

	it("accounts for exactly one copy when the same page renders concurrently", async () => {
		// Two shapes showing the same page at the same size (e.g. a duplicated
		// page) both miss the cache and render before either finishes. Writing
		// the same key twice must not double-count the budget, or the LRU starts
		// evicting live pages far too early.
		const { document } = fakeDocument();

		const [a, b] = await Promise.all([render(document, 256), render(document, 256)]);
		const single = a.width * a.height;

		expect(b.width * b.height).toBe(single);
		expect(cachedPixelCount()).toBe(single);
	});

	it("tracks the budget across distinct entries", async () => {
		const { document } = fakeDocument();

		const small = await render(document, 256);
		const large = await render(document, 1024);

		expect(cachedPixelCount()).toBe(small.width * small.height + large.width * large.height);
	});

	it("stops counting an entry once it is evicted", async () => {
		const { document } = fakeDocument();

		await render(document, 256);
		resetPageCache();

		expect(cachedPixelCount()).toBe(0);
	});
});
