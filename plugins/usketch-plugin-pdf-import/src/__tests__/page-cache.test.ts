// @vitest-environment jsdom
import type { PDFDocumentProxy } from "pdfjs-dist";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	activeRenderCount,
	cachedPixelCount,
	getCachedPage,
	renderPage,
	resetPageCache,
} from "../page-renderer.js";

/** A4-shaped fake document whose pages render instantly. */
function fakeDocument(): { document: PDFDocumentProxy; getPage: ReturnType<typeof vi.fn> } {
	const getPage = vi.fn(async () => ({
		getViewport: ({ scale }: { scale: number }) => ({ width: 595 * scale, height: 842 * scale }),
		render: () => ({ promise: Promise.resolve() }),
		cleanup: vi.fn(),
	}));
	return { document: { getPage } as unknown as PDFDocumentProxy, getPage };
}

function render(
	document: PDFDocumentProxy,
	width: number,
	pageNumber = 1,
	documentKey = "asset:a",
) {
	return renderPage({
		documentKey,
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

describe("render concurrency", () => {
	it("never runs more than three renders, even when a caller arrives as a slot frees", async () => {
		const finishers: (() => void)[] = [];
		let peak = 0;
		let lateCaller: Promise<unknown> | undefined;
		const document = {
			getPage: vi.fn(async (pageNumber: number) => ({
				getViewport: ({ scale }: { scale: number }) => ({
					width: 595 * scale,
					height: 842 * scale,
				}),
				render: () => {
					peak = Math.max(peak, activeRenderCount());
					return { promise: new Promise<void>((resolve) => finishers.push(resolve)) };
				},
				cleanup: () => {
					// Runs just before the slot is released: start a new render on
					// the microtask that lands between the release and the queued
					// waiter resuming — the window the old `if` let through.
					if (pageNumber === 1 && !lateCaller) {
						queueMicrotask(() => {
							lateCaller = render(document, 256, 9);
						});
					}
				},
			})),
		} as unknown as PDFDocumentProxy;

		const renders = [1, 2, 3, 4].map((page) => render(document, 256, page));
		await vi.waitFor(() => expect(finishers).toHaveLength(3));

		finishers[0]?.();
		await vi.waitFor(() => expect(lateCaller).toBeDefined());
		await vi.waitFor(() => expect(finishers.length).toBeGreaterThanOrEqual(4));

		expect(peak).toBeLessThanOrEqual(3);
		expect(activeRenderCount()).toBeLessThanOrEqual(3);

		// Drain everything so no render leaks into the next test. Finishing one
		// render lets a queued one start, so keep finishing until all five ran.
		const all = Promise.all([...renders, lateCaller]);
		let finished = 1;
		while (finished < 5) {
			await vi.waitFor(() => expect(finishers.length).toBeGreaterThan(finished));
			finishers[finished]?.();
			finished++;
		}
		await all;
		expect(activeRenderCount()).toBe(0);
	});
});
