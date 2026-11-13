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
} from "@edv4h/usketch-sync";
import type * as Y from "yjs";
import { duplicatePage, neighborPage, nextPageName, type OpenPageDoc } from "./pages-ops.js";

export interface PagesApiDeps {
	/** ルート doc（ページ一覧がある）。 */
	root: Y.Doc;
	/** 今開いているページ。 */
	currentPageId: string;
	/** ページを切り替える（ホストが URL を変えて開き直す）。 */
	switchPage: (pageId: string) => void;
	/** ページ doc を開く。無ければ複製はできない。 */
	openPageDoc?: OpenPageDoc;
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
	/** ページを足す。`after` を省くと今のページの直後。`open` で足したページへ移る。 */
	create(options?: { name?: string; after?: string | null; open?: boolean }): PageMeta;
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
}

export function createPagesApi(deps: PagesApiDeps): PagesApi {
	const { root, currentPageId } = deps;
	const now = deps.now ?? Date.now;
	const indexOf = (pageId: string) => listPages(root).findIndex((p) => p.id === pageId);

	return {
		currentPageId,
		list: (options) => listPages(root, options),
		listDeleted: () =>
			listPages(root, { includeDeleted: true })
				.filter((p) => p.deletedAt !== undefined)
				.sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
		subscribe: (listener) => observePages(root, listener),
		switchTo: (pageId) => {
			if (pageId !== currentPageId) deps.switchPage(pageId);
		},
		go(step) {
			const target = neighborPage(root, currentPageId, step);
			if (!target) return false;
			deps.switchPage(target.id);
			return true;
		},
		create(options = {}) {
			const page = createPage(root, {
				name: options.name ?? nextPageName(root),
				after: options.after === undefined ? currentPageId : options.after,
				now: now(),
			});
			if (options.open) deps.switchPage(page.id);
			return page;
		},
		rename: (pageId, name) => renamePage(root, pageId, name.trim() || "ページ"),
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
		canDelete: (pageId) => listPages(root).length > 1 && indexOf(pageId) >= 0,
		delete(pageId) {
			const fallback =
				pageId === currentPageId
					? (neighborPage(root, pageId, 1) ?? neighborPage(root, pageId, -1))
					: null;
			const page = deletePage(root, pageId, { now: now() });
			if (fallback) deps.switchPage(fallback.id);
			return page;
		},
		restore: (pageId) => restorePage(root, pageId),
	};
}
