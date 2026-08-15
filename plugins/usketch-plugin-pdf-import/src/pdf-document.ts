import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfPageSize } from "./types.js";

/**
 * pdf.js needs its worker as a URL it can fetch at runtime. This plugin is
 * compiled with plain `tsc`, so bundler-specific forms (`?url`,
 * `new URL(…, import.meta.url)`) are unavailable — the worker is loaded from a
 * CDN pinned to the exact bundled version, the same approach the export plugin
 * uses for its font. Hosts that cannot reach a CDN pass `workerSrc`.
 */
const CDN_WORKER_URL = (version: string) =>
	`https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

let configuredWorkerSrc: string | undefined;

/** Set once from the plugin's options, before any document is opened. */
export function setWorkerSrc(workerSrc: string | undefined): void {
	configuredWorkerSrc = workerSrc;
}

/**
 * pdf.js is imported dynamically so the ~1MB library is code-split out of the
 * plugin entry and only fetched when a PDF is actually on the board.
 */
async function loadPdfjs() {
	const pdfjs = await import("pdfjs-dist");
	// Don't clobber a host that already configured pdf.js for its own use.
	if (configuredWorkerSrc) {
		pdfjs.GlobalWorkerOptions.workerSrc = configuredWorkerSrc;
	} else if (!pdfjs.GlobalWorkerOptions.workerSrc) {
		pdfjs.GlobalWorkerOptions.workerSrc = CDN_WORKER_URL(pdfjs.version);
	}
	return pdfjs;
}

interface CacheEntry {
	document: Promise<PDFDocumentProxy>;
	destroy: () => Promise<void>;
	/** Number of live holders; the document is torn down when it hits zero. */
	refCount: number;
}

const documents = new Map<string, CacheEntry>();

/**
 * Open a PDF, sharing one `PDFDocumentProxy` across every page shape that
 * references it. A 50-page import must not open 50 copies of the same
 * document — they would each spin up worker state for the same bytes.
 *
 * Every `acquireDocument` must be paired with a `releaseDocument`.
 */
export function acquireDocument(key: string, src: string): Promise<PDFDocumentProxy> {
	const existing = documents.get(key);
	if (existing) {
		existing.refCount++;
		return existing.document;
	}

	// Assigned once the loading task exists; `destroy()` lives on the task, not
	// on the document, in pdf.js v6.
	let destroy: () => Promise<void> = async () => undefined;
	const document = (async () => {
		const pdfjs = await loadPdfjs();
		const data = await fetchPdfBytes(src);
		const task = pdfjs.getDocument({ data });
		destroy = () => task.destroy();
		try {
			return await task.promise;
		} catch (err) {
			// A failed open must not poison the cache — the next attempt
			// (e.g. after the network comes back) should retry cleanly.
			documents.delete(key);
			throw explainFailure(err);
		}
	})();

	documents.set(key, { refCount: 1, document, destroy: () => destroy() });
	return document;
}

/**
 * Grace period before an unreferenced document is torn down. Panning a page
 * out of view unmounts its shape (viewport LOD), so a single-page PDF would
 * otherwise be closed and reopened on every pass.
 */
const TEARDOWN_DELAY_MS = 5_000;

/** Drop one reference; tears the document down once nobody holds it. */
export function releaseDocument(key: string): void {
	const entry = documents.get(key);
	if (!entry) return;
	entry.refCount--;
	if (entry.refCount > 0) return;
	setTimeout(() => {
		// A shape may have re-acquired it while we waited.
		if (documents.get(key) !== entry || entry.refCount > 0) return;
		documents.delete(key);
		// `destroy()` also terminates the worker's state for this document.
		void entry.document.catch(() => undefined).then(() => entry.destroy());
	}, TEARDOWN_DELAY_MS);
}

/** Read the intrinsic size of every page, for laying the import out. */
export async function readPageSizes(
	document: PDFDocumentProxy,
	maxPages: number,
	onProgress?: (page: number, total: number) => void,
): Promise<{ sizes: PdfPageSize[]; totalPages: number; truncated: boolean }> {
	const totalPages = document.numPages;
	const count = Math.min(totalPages, maxPages);
	const sizes: PdfPageSize[] = [];
	for (let pageNumber = 1; pageNumber <= count; pageNumber++) {
		const page = await document.getPage(pageNumber);
		try {
			// scale 1 → 1 PDF point per unit, which is also the CSS-px size.
			const viewport = page.getViewport({ scale: 1 });
			sizes.push({ pageNumber, width: viewport.width, height: viewport.height });
		} finally {
			page.cleanup();
		}
		onProgress?.(pageNumber, count);
	}
	return { sizes, totalPages, truncated: totalPages > count };
}

/**
 * pdf.js wants bytes. Asset sources are data URLs by default, but a host that
 * routes uploads to real storage hands back an ordinary URL instead.
 */
async function fetchPdfBytes(src: string): Promise<Uint8Array> {
	const response = await fetch(src);
	if (!response.ok) {
		throw new Error(`PDFを取得できませんでした (HTTP ${response.status})`);
	}
	return new Uint8Array(await response.arrayBuffer());
}

/**
 * pdf.js reports load failures through exception subclasses. Match on `name`
 * rather than `instanceof`: the dynamic import may resolve to a different
 * module instance than any statically imported copy. Anything unrecognized
 * passes through unchanged.
 */
export function explainFailure(err: unknown): Error {
	const name = err instanceof Error ? err.name : "";
	if (name === "PasswordException") {
		return new Error("パスワード付きPDFのため読み込めません");
	}
	if (name === "InvalidPDFException") {
		return new Error("PDFファイルが壊れているか、PDFではありません");
	}
	if (err instanceof Error) return err;
	return new Error(String(err));
}

/** Test seam: forget every cached document. */
export function resetDocumentCache(): void {
	documents.clear();
}
