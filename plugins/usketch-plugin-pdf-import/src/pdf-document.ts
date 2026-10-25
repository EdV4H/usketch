import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfPageSize } from "./types.js";

let configuredWorkerSrc: string | undefined;

/** Set once from the plugin's options, before any document is opened. */
export function setWorkerSrc(workerSrc: string | undefined): void {
	configuredWorkerSrc = workerSrc;
}

/**
 * pdf.js is imported dynamically so the ~1MB library is code-split out of the
 * plugin entry and only fetched when a PDF is actually on the board.
 *
 * The worker is executable code, so this never falls back to a third-party
 * CDN: the host must serve it itself (`workerSrc`), or have configured pdf.js
 * already. This plugin is compiled with plain `tsc`, so it cannot reference the
 * worker file with bundler syntax on the host's behalf.
 */
async function loadPdfjs() {
	const pdfjs = await import("pdfjs-dist");
	// Don't clobber a host that already configured pdf.js for its own use.
	if (configuredWorkerSrc) {
		pdfjs.GlobalWorkerOptions.workerSrc = configuredWorkerSrc;
	} else if (!pdfjs.GlobalWorkerOptions.workerSrc) {
		throw new Error(
			"pdf.js のワーカーが設定されていません（createPdfImportPlugin の workerSrc を指定してください）",
		);
	}
	return pdfjs;
}

interface CacheEntry {
	document: Promise<PDFDocumentProxy>;
	destroy: () => Promise<void>;
	/** Number of live holders; the document is torn down when it hits zero. */
	refCount: number;
	/** Pending teardown, cancelled if a holder comes back during the grace period. */
	teardown?: ReturnType<typeof setTimeout>;
}

/** One holder's claim on a shared document. Release it exactly once. */
export interface DocumentLease {
	document: Promise<PDFDocumentProxy>;
	/** Drop this holder's reference. Idempotent. */
	release(): void;
	/**
	 * Move the still-held document under `key`, so a later `acquireDocument(key)`
	 * reuses it instead of fetching and parsing the bytes again. No-op when `key`
	 * is already cached (the same document was imported before).
	 */
	rekey(key: string): void;
}

const documents = new Map<string, CacheEntry>();

/**
 * Grace period before an unreferenced document is torn down. Panning a page
 * out of view unmounts its shape (viewport LOD), so a single-page PDF would
 * otherwise be closed and reopened on every pass.
 */
const TEARDOWN_DELAY_MS = 5_000;

/**
 * Open a PDF, sharing one `PDFDocumentProxy` across every page shape that
 * references it. A 50-page import must not open 50 copies of the same
 * document — they would each spin up worker state for the same bytes.
 *
 * The lease is bound to the entry it was taken on, not to `key`: after a
 * failed open drops the entry, a later acquire under the same key gets a fresh
 * one that a stale release must not touch.
 */
export function acquireDocument(key: string, src: string): DocumentLease {
	let entry = documents.get(key);
	if (entry) {
		entry.refCount++;
		clearTimeout(entry.teardown);
		entry.teardown = undefined;
	} else {
		entry = openDocument(src);
		documents.set(key, entry);
	}
	return leaseOn(entry);
}

function openDocument(src: string): CacheEntry {
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
			// A failed open (e.g. a PasswordException) leaves the loading task
			// alive in the worker, and nobody else holds a handle to it.
			void task.destroy();
			throw explainFailure(err);
		}
	})();
	const entry: CacheEntry = { refCount: 1, document, destroy: () => destroy() };
	// A failed open must not poison the cache — the next attempt (e.g. after
	// the network comes back) should retry cleanly. Covers failures before the
	// task exists too (no worker configured, fetch failed). The entry may have
	// been rekeyed meanwhile, so look it up by identity.
	document.catch(() => forget(entry));
	return entry;
}

function leaseOn(entry: CacheEntry): DocumentLease {
	let released = false;
	return {
		document: entry.document,
		release() {
			if (released) return;
			released = true;
			entry.refCount--;
			if (entry.refCount > 0 || !isCached(entry)) return;
			entry.teardown = setTimeout(() => {
				if (entry.refCount > 0) return;
				forget(entry);
				// `destroy()` also terminates the worker's state for this document.
				// Its rendered bitmaps stay in the page cache, under its budget, so
				// a page that comes back into view paints at once.
				void entry.document.catch(() => undefined).then(() => entry.destroy());
			}, TEARDOWN_DELAY_MS);
		},
		rekey(key) {
			if (released || documents.has(key)) return;
			forget(entry);
			documents.set(key, entry);
		},
	};
}

function isCached(entry: CacheEntry): boolean {
	for (const cached of documents.values()) if (cached === entry) return true;
	return false;
}

function forget(entry: CacheEntry): void {
	clearTimeout(entry.teardown);
	for (const [key, cached] of documents) {
		if (cached === entry) documents.delete(key);
	}
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
	for (const entry of documents.values()) clearTimeout(entry.teardown);
	documents.clear();
}
