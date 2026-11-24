// ホスト・他のプラグイン向けのページ API。HUD のページパネルもこれを呼ぶだけにする。
import {
	createPage,
	deletePage,
	listPages,
	observePages,
	type PageMeta,
	renamePage,
	reorderPage,
	restorePage,
	setPagePlugins,
} from "@edv4h/usketch-sync";
import type * as Y from "yjs";
import { copyShapesToPage, moveShapesToPage } from "./page-transfer.js";
import { duplicatePage, neighborPage, nextPageName, type OpenPageDoc } from "./pages-ops.js";

/**
 * ホストがページの見え方を変える（権限で見られないページを隠す・伏せた名前の代わりを出す）。
 * ページ一覧はルート doc にあり全員に届くので、見せてよいかはホストが決める。
 */
export interface PageView {
	/** 一覧に出すか（見る権限があるか）。省略すると全部出す。 */
	isVisible?(pageId: string): boolean;
	/** 出す名前（ルート doc で伏せたページの本当の名前など）。undefined ならルート doc の名前。 */
	displayName?(page: PageMeta): string | undefined;
	/**
	 * 名前を変える。ホストが引き受けたら true（伏せたページは別の場所に名前があるので、
	 * ルート doc には書かない）。false ならルート doc の名前を変える。
	 */
	rename?(pageId: string, name: string): boolean;
	/** 見え方が変わったら呼ぶ（権限や名前を読み直した）。 */
	subscribe?(listener: () => void): () => void;
}

export interface PagesApiDeps {
	/** ルート doc（ページ一覧がある）。 */
	root: Y.Doc;
	/** 今開いているページ。 */
	currentPageId: string;
	/** ページを切り替える（ホストが URL を変えて開き直す）。 */
	switchPage: (pageId: string) => void;
	/** ページ doc を開く。無ければ複製と、ページをまたぐ移動・コピーはできない。 */
	openPageDoc?: OpenPageDoc;
	/** ページの見え方（権限で隠す・名前を変える）。 */
	view?: PageView;
	now?: () => number;
}

export interface PagesApi {
	readonly currentPageId: string;
	/** ページを並び順で返す（既定では削除済みを除く）。 */
	list(options?: { includeDeleted?: boolean }): PageMeta[];
	/** 削除したページ（新しく消した順）。 */
	listDeleted(): PageMeta[];
	/** ページ一覧の変化を購読する。 */
	subscribe(listener: () => void): () => void;
	switchTo(pageId: string): void;
	/** 次（step 1）・前（-1）のページへ。端なら何もしないで false。 */
	go(step: 1 | -1): boolean;
	/**
	 * ページを足す。`after` を省くと今のページの直後。`open` で足したページへ移る。
	 * `preset` はホストのプリセット名（そのプリセットのプラグインで開く）。
	 */
	create(options?: {
		name?: string;
		after?: string | null;
		open?: boolean;
		preset?: string;
	}): PageMeta;
	/**
	 * ページのプラグインを決める（ホストのカタログの id）。`null` でプリセットのままに戻す。
	 * 今のページを変えると、ホストがそのプラグインで開き直す。
	 */
	setPlugins(pageId: string, plugins: readonly string[] | null): PageMeta;
	rename(pageId: string, name: string): PageMeta;
	/** 並び順の `toIndex` 番目へ動かす。 */
	reorder(pageId: string, toIndex: number): PageMeta;
	/** `step` だけ前後へ動かす。 */
	move(pageId: string, step: number): PageMeta;
	readonly canDuplicate: boolean;
	duplicate(pageId: string, options?: { open?: boolean }): Promise<PageMeta>;
	/** 最後の 1 枚なら false（削除しない）。 */
	canDelete(pageId: string): boolean;
	/** 削除する（戻せる）。今のページなら隣のページへ移る。 */
	delete(pageId: string): PageMeta;
	restore(pageId: string): PageMeta;
	/** ページをまたいでシェイプを移す・写せるか（`openPageDoc` があるか）。 */
	readonly canTransfer: boolean;
	/**
	 * 今のページのシェイプ（子孫と、両端が含まれるコネクタも）を別のページへ移す。id は変えず、
	 * 移動先の一番手前に置く。移さなかったものへの参照（親・コネクタの端）は外す。
	 * `open` で移動先へ移る。移したシェイプの id を返す。
	 */
	moveShapes(
		ids: Iterable<string>,
		toPageId: string,
		options?: { open?: boolean },
	): Promise<string[]>;
	/** {@link moveShapes} と同じ範囲を、新しい id で別のページへ写す。写したシェイプの id を返す。 */
	copyShapes(
		ids: Iterable<string>,
		toPageId: string,
		options?: { open?: boolean },
	): Promise<string[]>;
}

export function createPagesApi(deps: PagesApiDeps): PagesApi {
	const { root, currentPageId, view } = deps;
	const now = deps.now ?? Date.now;

	/** 見え方を当てたページ一覧（見られないページを除き、名前を差し替える）。 */
	function visible(options?: { includeDeleted?: boolean }): PageMeta[] {
		const pages = listPages(root, options);
		if (!view) return pages;
		const result: PageMeta[] = [];
		for (const page of pages) {
			// 今開いているページは、開けている以上は見られる
			if (page.id !== currentPageId && view.isVisible && !view.isVisible(page.id)) continue;
			const name = view.displayName?.(page);
			result.push(name === undefined ? page : { ...page, name });
		}
		return result;
	}
	const indexOf = (pageId: string) => visible().findIndex((p) => p.id === pageId);
	/** 見えるページの中で、`pageId` の次・前。 */
	const neighbor = (pageId: string, step: 1 | -1): PageMeta | null => {
		if (!view) return neighborPage(root, pageId, step);
		const pages = visible();
		const index = pages.findIndex((p) => p.id === pageId);
		return index < 0 ? null : (pages[index + step] ?? null);
	};

	/** 今のページと `toPageId` のページ doc を開き、読み込みを待って `run` する。 */
	async function transfer(
		toPageId: string,
		open: boolean | undefined,
		run: (from: Y.Doc, to: Y.Doc) => string[],
	): Promise<string[]> {
		const openPageDoc = deps.openPageDoc;
		if (!openPageDoc) throw new Error("Moving shapes between pages needs openPageDoc");
		if (toPageId === currentPageId) throw new Error("The target page is the current page");
		if (indexOf(toPageId) < 0) throw new Error(`Page not found: ${toPageId}`);
		const from = openPageDoc(currentPageId);
		const to = openPageDoc(toPageId);
		let ids: string[];
		try {
			await Promise.all([from.whenLoaded, to.whenLoaded]);
			ids = run(from.doc, to.doc);
		} finally {
			to.release();
			from.release();
		}
		if (open && ids.length > 0) deps.switchPage(toPageId);
		return ids;
	}

	return {
		currentPageId,
		list: (options) => visible(options),
		listDeleted: () =>
			visible({ includeDeleted: true })
				.filter((p) => p.deletedAt !== undefined)
				.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
		subscribe(listener) {
			const offPages = observePages(root, listener);
			const offView = view?.subscribe?.(listener);
			return () => {
				offPages();
				offView?.();
			};
		},
		switchTo: (pageId) => {
			if (pageId !== currentPageId) deps.switchPage(pageId);
		},
		go(step) {
			const target = neighbor(currentPageId, step);
			if (!target) return false;
			deps.switchPage(target.id);
			return true;
		},
		create(options = {}) {
			const page = createPage(root, {
				name: options.name ?? nextPageName(root),
				after: options.after === undefined ? currentPageId : options.after,
				now: now(),
				preset: options.preset,
			});
			if (options.open) deps.switchPage(page.id);
			return page;
		},
		setPlugins: (pageId, plugins) => setPagePlugins(root, pageId, { plugins }),
		rename(pageId, name) {
			const next = name.trim() || "ページ";
			if (view?.rename?.(pageId, next)) {
				const page = visible({ includeDeleted: true }).find((p) => p.id === pageId);
				if (!page) throw new Error(`Page not found: ${pageId}`);
				return { ...page, name: next };
			}
			return renamePage(root, pageId, next);
		},
		reorder: (pageId, toIndex) => reorderPage(root, pageId, toIndex),
		move(pageId, step) {
			return reorderPage(root, pageId, indexOf(pageId) + step);
		},
		canDuplicate: deps.openPageDoc !== undefined,
		async duplicate(pageId, options = {}) {
			if (!deps.openPageDoc) throw new Error("Duplicating pages needs openPageDoc");
			const page = await duplicatePage(root, pageId, deps.openPageDoc);
			if (options.open) deps.switchPage(page.id);
			return page;
		},
		canDelete: (pageId) => visible().length > 1 && indexOf(pageId) >= 0,
		delete(pageId) {
			const fallback =
				pageId === currentPageId ? (neighbor(pageId, 1) ?? neighbor(pageId, -1)) : null;
			const page = deletePage(root, pageId, { now: now() });
			if (fallback) deps.switchPage(fallback.id);
			return page;
		},
		restore: (pageId) => restorePage(root, pageId),
		canTransfer: deps.openPageDoc !== undefined,
		moveShapes: (ids, toPageId, options = {}) =>
			transfer(toPageId, options.open, (from, to) => moveShapesToPage(from, to, ids, toPageId)),
		copyShapes: (ids, toPageId, options = {}) =>
			transfer(toPageId, options.open, (from, to) => copyShapesToPage(from, to, ids)),
	};
}
