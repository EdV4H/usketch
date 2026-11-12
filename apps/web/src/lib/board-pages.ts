import type { PageDocManager, PageMeta, ServerClock, WsProviderHandle } from "@edv4h/usketch-sync";
import { isValidDocId } from "@edv4h/usketch-sync";
import type * as Y from "yjs";

/** ボードを開いている間ずっと生きているもの（ページを切り替えても作り直さない）。 */
export interface BoardRuntime {
	boardId: string;
	rootDoc: Y.Doc;
	/** Cloud ボードの接続。ローカルボードは null。 */
	wsProvider: WsProviderHandle | null;
	serverClock: ServerClock;
	pageDocs: PageDocManager;
}

/** ルート doc から読んだページの状態。 */
export interface PagesState {
	/** ページを使うボードか（`meta.pagesVersion` があり、ページが 1 枚以上ある）。 */
	paged: boolean;
	pages: PageMeta[];
}

/** ページ doc を保存する IndexedDB の名前。ルート doc は `usketch-board-<boardId>`。 */
export function pageDocName(boardId: string, pageId: string): string {
	return `usketch-board-${boardId}-page-${pageId}`;
}

/** URL の `?page=`。doc id として使えない値は無視する。 */
export function readRequestedPage(search: string): string | null {
	const id = new URLSearchParams(search).get("page");
	return id && isValidDocId(id) ? id : null;
}

// 前のページの中を指す deep-link（選択・視点）は、ページを移るときに外す。
const PAGE_LOCAL_PARAMS = ["shape", "x", "y", "zoom"];

/** `search` の `page` を差し替えた query string（先頭の `?` 付き、空なら ""）。 */
export function pageSearch(search: string, pageId: string): string {
	const params = new URLSearchParams(search);
	for (const key of PAGE_LOCAL_PARAMS) params.delete(key);
	params.set("page", pageId);
	const next = params.toString();
	return next ? `?${next}` : "";
}

const lastPageKey = (boardId: string) => `usketch:last-page:${boardId}`;

/** このボードで前回開いていたページ。 */
export function readLastPage(boardId: string): string | null {
	try {
		return localStorage.getItem(lastPageKey(boardId));
	} catch {
		return null;
	}
}

export function rememberLastPage(boardId: string, pageId: string): void {
	try {
		localStorage.setItem(lastPageKey(boardId), pageId);
	} catch {
		// localStorage が使えなくても、URL か先頭ページで開ける
	}
}
