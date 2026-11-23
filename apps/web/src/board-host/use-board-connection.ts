import { persistDocToIndexedDb } from "@edv4h/usketch-plugin-sync-localstorage-yjs";
import {
	createPageDocManager,
	createServerClock,
	createWsProvider,
	getPage,
	isPagedBoard,
	listPages,
	observePages,
	type WsProviderHandle,
} from "@edv4h/usketch-sync";
import { type Dispatch, type RefObject, type SetStateAction, useEffect } from "react";
import * as Y from "yjs";
import { type BoardRuntime, type PagesState, pageDocName } from "../lib/board-pages.js";
import { connectionStatusStore } from "../lib/connection-status-store.js";
import { getDevUser } from "../lib/dev-auth.js";
import { migrateLocalBoard } from "../lib/local-pages-migration.js";
import { presenceStore, readPresenceMembers } from "../lib/presence-store.js";
import { API_URL } from "./host-wiring.js";

/** 開くボード。 */
export interface BoardSource {
	boardId: string;
	/** ルート doc を保存する IndexedDB の名前。 */
	persistName: string;
	/** サーバーにつなぐか（ローカルボード・未ログインの地域はつながない）。 */
	connect: boolean;
	/** 手元のボードをページ形式へ移す（ローカルボードだけ。クラウドはサーバーが移す）。 */
	migrateLocal?: boolean;
}

/**
 * ボード単位で生きているもの（ルート doc・IndexedDB・WebSocket・サーバー時計・ページ doc の
 * 管理役）を作り、ページの一覧を読む。ページを切り替えても作り直さない。
 *
 * つないでいる間は、接続の状態を HUD の状態表示へ、オンラインの人を Members パネルへ流す。
 * 状態はホスト（`useBoardHost`）が持つ。
 */
export function useBoardConnection(
	source: BoardSource | null,
	switchPageRef: RefObject<(pageId: string) => void>,
	setBoard: Dispatch<SetStateAction<BoardRuntime | null>>,
	setPagesState: Dispatch<SetStateAction<PagesState | null>>,
): void {
	const boardId = source?.boardId ?? null;
	const persistName = source?.persistName ?? null;
	const connect = source?.connect ?? false;
	const migrateLocal = source?.migrateLocal ?? false;

	useEffect(() => {
		if (!boardId || !persistName) return;

		let cancelled = false;
		const rootDoc = new Y.Doc();
		const rootPersistence = persistDocToIndexedDb(persistName, rootDoc);

		// 共有タイマーなどが「今」を揃えるための時計。つないでいるボードはサーバーとのずれを測り、
		// 手元のボードは手元の時計を使う。
		const serverClock = createServerClock({ baseUrl: connect ? API_URL : null });

		let wsProvider: WsProviderHandle | null = null;
		let offPresence: (() => void) | null = null;

		if (connect) {
			let wsUrl = `${API_URL.replace(/^http/, "ws")}/api/boards/${boardId}/ws`;
			// 開発中: WebSocket はヘッダーを送れないのでクエリで誰かを伝える
			if (import.meta.env.DEV) {
				const devUser = getDevUser();
				if (devUser) wsUrl += `?devUserId=${encodeURIComponent(devUser.id)}`;
			}
			wsProvider = createWsProvider({ url: wsUrl, doc: rootDoc });
			wsProvider.onStatusChange(connectionStatusStore.set);

			// オンラインの人を Members パネルへ。ページに関係なくボードの全員を出し、ページを
			// 使うボードでは各人のページ名と「別のページにいるか」も添える。
			const awareness = wsProvider.awareness;
			const pageName = (id: string) =>
				isPagedBoard(rootDoc) ? (getPage(rootDoc, id)?.name ?? null) : null;
			const updatePresence = () => presenceStore.set(readPresenceMembers(awareness, pageName));
			awareness.on("change", updatePresence);
			const offPageNames = observePages(rootDoc, updatePresence);
			presenceStore.openPage = (id) => switchPageRef.current?.(id);
			updatePresence();
			offPresence = () => {
				awareness.off("change", updatePresence);
				offPageNames();
				presenceStore.openPage = null;
			};
		}

		const pageDocs = createPageDocManager({
			provider: wsProvider,
			persist: (pageId, doc) => persistDocToIndexedDb(pageDocName(boardId, pageId), doc),
		});

		// ページ一覧と「ページを使うボードか」はルート doc から読む。サーバーから版が届いて
		// ページを使うボードだと分かった時点で、ページ単位の App が開き直す。
		const readPages = () =>
			setPagesState({ paged: isPagedBoard(rootDoc), pages: listPages(rootDoc) });
		const offPages = observePages(rootDoc, readPages);

		rootPersistence.whenSynced.then(async () => {
			if (cancelled) return;
			if (migrateLocal) {
				try {
					await migrateLocalBoard(boardId, rootDoc, {
						migrate: import.meta.env.VITE_PAGES_MIGRATION === "true",
					});
				} catch (e) {
					console.error("[pages] Local board migration failed:", e);
				}
				if (cancelled) return;
			}
			readPages();
			setBoard({ boardId, rootDoc, wsProvider, serverClock, pageDocs });
		});

		return () => {
			cancelled = true;
			offPages();
			pageDocs.destroy();
			offPresence?.();
			presenceStore.set([]);
			wsProvider?.destroy();
			connectionStatusStore.set(null);
			serverClock.destroy();
			rootPersistence.destroy();
			rootDoc.destroy();
			setBoard(null);
			setPagesState(null);
		};
	}, [boardId, persistName, connect, migrateLocal, switchPageRef, setBoard, setPagesState]);
}
