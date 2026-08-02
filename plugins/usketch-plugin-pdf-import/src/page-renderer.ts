import type { PDFDocumentProxy } from "pdfjs-dist";

/** Never render below this width — a sliver of a page is still legible-ish. */
const MIN_RENDER_WIDTH = 128;

/**
 * How much rendered bitmap to keep around, in total pixels (~4 bytes each).
 * 24M px ≈ 96MB, enough to hold a handful of full-resolution pages so that
 * panning back to a page (which unmounts and remounts it under viewport LOD)
 * is instant instead of re-running pdf.js.
 */
const CACHE_PIXEL_BUDGET = 24_000_000;

/** Concurrent pdf.js renders. Bounded so a 50-page import can't stampede. */
const MAX_CONCURRENT_RENDERS = 3;

/**
 * Device-pixel width a page needs to look sharp right now, quantized to powers
 * of two.
 *
 * Quantizing matters: the world layer is CSS-scaled, so without it a pinch
 * gesture would kick off a fresh pdf.js render on every animation frame. Powers
 * of two mean at most a handful of distinct renders across the whole zoom
 * range, and re-renders land on zoom boundaries rather than continuously.
 */
export function targetRenderWidth(
	worldWidth: number,
	zoom: number,
	devicePixelRatio: number,
	maxRenderSize: number,
): number {
	const needed = worldWidth * zoom * devicePixelRatio;
	const quantized = 2 ** Math.ceil(Math.log2(Math.max(needed, 1)));
	return Math.round(clamp(quantized, MIN_RENDER_WIDTH, Math.max(maxRenderSize, MIN_RENDER_WIDTH)));
}

/** Fit `content` inside `box` preserving aspect ratio (letterbox). */
export function containSize(
	boxWidth: number,
	boxHeight: number,
	contentWidth: number,
	contentHeight: number,
): { width: number; height: number } {
	if (contentWidth <= 0 || contentHeight <= 0) return { width: boxWidth, height: boxHeight };
	const scale = Math.min(boxWidth / contentWidth, boxHeight / contentHeight);
	return { width: contentWidth * scale, height: contentHeight * scale };
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

interface CacheEntry {
	canvas: HTMLCanvasElement;
	pixels: number;
}

// Insertion-ordered: Map iteration yields the least-recently-used first once
// hits re-insert their entry at the end.
const cache = new Map<string, CacheEntry>();
let cachedPixels = 0;

function cacheKey(documentKey: string, pageNumber: number, width: number): string {
	return `${documentKey}:${pageNumber}:${width}`;
}

/** Cached render for this exact size, if one is still resident. */
export function getCachedPage(
	documentKey: string,
	pageNumber: number,
	width: number,
): HTMLCanvasElement | undefined {
	const key = cacheKey(documentKey, pageNumber, width);
	const entry = cache.get(key);
	if (!entry) return undefined;
	cache.delete(key);
	cache.set(key, entry);
	return entry.canvas;
}

/**
 * Best cached render for a page at any size — used to paint something
 * immediately while the correctly-sized render is still running, instead of
 * flashing an empty page.
 */
export function getAnyCachedPage(
	documentKey: string,
	pageNumber: number,
): HTMLCanvasElement | undefined {
	let best: CacheEntry | undefined;
	const prefix = `${documentKey}:${pageNumber}:`;
	for (const [key, entry] of cache) {
		if (!key.startsWith(prefix)) continue;
		if (!best || entry.pixels > best.pixels) best = entry;
	}
	return best?.canvas;
}

function putCachedPage(key: string, canvas: HTMLCanvasElement): void {
	const pixels = canvas.width * canvas.height;
	cache.set(key, { canvas, pixels });
	cachedPixels += pixels;
	for (const [oldest, entry] of cache) {
		if (cachedPixels <= CACHE_PIXEL_BUDGET) break;
		if (oldest === key) continue; // never evict what we just rendered
		cache.delete(oldest);
		cachedPixels -= entry.pixels;
	}
}

let activeRenders = 0;
const waiting: (() => void)[] = [];

async function acquireRenderSlot(): Promise<() => void> {
	if (activeRenders >= MAX_CONCURRENT_RENDERS) {
		await new Promise<void>((resolve) => waiting.push(resolve));
	}
	activeRenders++;
	let released = false;
	return () => {
		if (released) return;
		released = true;
		activeRenders--;
		waiting.shift()?.();
	};
}

export interface RenderPageOptions {
	/** Cache namespace — the asset id of the source document. */
	documentKey: string;
	document: PDFDocumentProxy;
	pageNumber: number;
	/** Device-pixel width of the render buffer. */
	width: number;
	signal: AbortSignal;
}

/**
 * Rasterize one page into an offscreen canvas at the requested width.
 * Rendering offscreen (rather than straight into the on-screen canvas) means a
 * re-render at a new zoom level never blanks the page mid-flight.
 */
export async function renderPage({
	documentKey,
	document: pdf,
	pageNumber,
	width,
	signal,
}: RenderPageOptions): Promise<HTMLCanvasElement> {
	const key = cacheKey(documentKey, pageNumber, width);
	const cached = getCachedPage(documentKey, pageNumber, width);
	if (cached) return cached;

	const release = await acquireRenderSlot();
	try {
		if (signal.aborted) throw abortError();
		const page = await pdf.getPage(pageNumber);
		try {
			if (signal.aborted) throw abortError();
			const base = page.getViewport({ scale: 1 });
			const viewport = page.getViewport({ scale: width / base.width });

			const canvas = globalThis.document.createElement("canvas");
			canvas.width = Math.max(1, Math.round(viewport.width));
			canvas.height = Math.max(1, Math.round(viewport.height));
			const context = canvas.getContext("2d", { alpha: false });
			if (!context) throw new Error("Canvas 2D コンテキストを取得できませんでした");

			const task = page.render({ canvas, canvasContext: context, viewport });
			const onAbort = () => task.cancel();
			signal.addEventListener("abort", onAbort, { once: true });
			try {
				await task.promise;
			} finally {
				signal.removeEventListener("abort", onAbort);
			}

			putCachedPage(key, canvas);
			return canvas;
		} finally {
			page.cleanup();
		}
	} finally {
		release();
	}
}

function abortError(): Error {
	return Object.assign(new Error("render aborted"), { name: "AbortError" });
}

/** pdf.js signals a cancelled render by throwing; that is not a real failure. */
export function isCancellation(err: unknown): boolean {
	const name = err instanceof Error ? err.name : "";
	return name === "AbortError" || name === "RenderingCancelledException";
}

/** Test seam: forget every cached bitmap. */
export function resetPageCache(): void {
	cache.clear();
	cachedPixels = 0;
}
