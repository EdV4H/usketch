import * as Y from "yjs";
import { pageDocGuid } from "./pages.js";
import type { DocSubscription, WsProviderHandle } from "./ws-provider.js";

/** ページ doc を手元に保存する仕組み（IndexedDB など）。 */
export interface PageDocPersistence {
	/** 保存済みの中身を doc に読み込み終えたら解決する。 */
	whenSynced: Promise<void>;
	destroy(): void;
}

export interface PageDocManagerOptions {
	/** サーバーと同期する provider。ローカルボードでは省略する。 */
	provider?: Pick<WsProviderHandle, "subscribeDoc"> | null;
	/** ページ doc を手元に保存する仕組みを作る。省略するとメモリだけ。 */
	persist?: (pageId: string, doc: Y.Doc) => PageDocPersistence | null;
	/**
	 * 開いていないページも含めて手元に残しておく doc の数（開いているページを含む）。
	 * 直前に開いたページを購読したまま残し、行き来を速くする。既定 3。
	 */
	keep?: number;
	/**
	 * 手元に中身が無いページを開いたときに、サーバーからの同期を待つ上限（ms）。
	 * オフラインでも開けるように、過ぎたら空のまま開く。既定 3000。
	 */
	serverSyncTimeoutMs?: number;
}

/** {@link PageDocManager.open} の戻り値。使い終わったら `release()` する。 */
export interface PageDocHandle {
	readonly pageId: string;
	readonly doc: Y.Doc;
	/**
	 * 中身を読み込み終えたら解決する。手元の保存を読み、それで空ならサーバーとの同期を
	 * （`serverSyncTimeoutMs` まで）待つ。
	 */
	readonly whenLoaded: Promise<void>;
	release(): void;
}

export interface PageDocManager {
	open(pageId: string): PageDocHandle;
	/** 手元に残っている（購読中の）ページ。古い順。 */
	loadedPageIds(): string[];
	destroy(): void;
}

interface Entry {
	doc: Y.Doc;
	persistence: PageDocPersistence | null;
	subscription: DocSubscription | null;
	whenLoaded: Promise<void>;
	refs: number;
}

function hasState(doc: Y.Doc): boolean {
	// 空の doc の state vector は `[0]`（1 バイト）。
	return Y.encodeStateVector(doc).length > 1;
}

/**
 * ページ doc の管理役。ページごとに Y.Doc を作り、手元の保存とサーバーの購読を張る。
 * 開いていないページも直前のものは `keep` 枚まで残し、超えたら古いものから外す。
 */
export function createPageDocManager(options: PageDocManagerOptions = {}): PageDocManager {
	const { provider = null, persist, keep = 3, serverSyncTimeoutMs = 3000 } = options;
	// Map の挿入順を「使った順」として使う（古い順）。
	const entries = new Map<string, Entry>();
	const timers = new Set<ReturnType<typeof setTimeout>>();
	let destroyed = false;

	function waitServer(subscription: DocSubscription): Promise<void> {
		return new Promise<void>((resolve) => {
			const timer = setTimeout(() => {
				timers.delete(timer);
				resolve();
			}, serverSyncTimeoutMs);
			timers.add(timer);
			subscription.whenSynced.then(() => {
				clearTimeout(timer);
				timers.delete(timer);
				resolve();
			});
		});
	}

	function load(pageId: string): Entry {
		const doc = new Y.Doc({ guid: pageDocGuid(pageId) });
		const persistence = persist?.(pageId, doc) ?? null;
		const subscription = provider ? provider.subscribeDoc(pageId, doc) : null;
		const local = persistence ? persistence.whenSynced : Promise.resolve();
		const whenLoaded = local.then(() => {
			if (!subscription || hasState(doc)) return;
			return waitServer(subscription);
		});
		return { doc, persistence, subscription, whenLoaded, refs: 0 };
	}

	function unload(pageId: string, entry: Entry): void {
		entries.delete(pageId);
		entry.subscription?.unsubscribe();
		entry.persistence?.destroy();
		entry.doc.destroy();
	}

	function evict(): void {
		for (const [pageId, entry] of entries) {
			if (entries.size <= keep) return;
			if (entry.refs === 0) unload(pageId, entry);
		}
	}

	function touch(pageId: string, entry: Entry): void {
		entries.delete(pageId);
		entries.set(pageId, entry);
	}

	return {
		open(pageId) {
			if (destroyed) throw new Error("PageDocManager is destroyed");
			let entry = entries.get(pageId);
			if (!entry) entry = load(pageId);
			touch(pageId, entry);
			entry.refs++;
			evict();
			const opened = entry;
			let released = false;
			return {
				pageId,
				doc: opened.doc,
				whenLoaded: opened.whenLoaded,
				release() {
					if (released) return;
					released = true;
					if (entries.get(pageId) !== opened) return;
					opened.refs--;
					evict();
				},
			};
		},
		loadedPageIds() {
			return [...entries.keys()];
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			for (const timer of timers) clearTimeout(timer);
			timers.clear();
			for (const [pageId, entry] of [...entries]) unload(pageId, entry);
		},
	};
}
