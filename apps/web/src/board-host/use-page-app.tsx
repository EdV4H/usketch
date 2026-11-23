import { TransientLayer } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { createYjsSync, type YjsSyncHandle } from "@edv4h/usketch-plugin-sync-localstorage-yjs";
import {
	createDivergenceTracker,
	type DivergenceTrackerHandle,
	UnconfirmedOverlay,
} from "@edv4h/usketch-plugin-sync-ywebsocket";
import type { UsketchPlugin } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { createPageScopedProvider, type WsProviderHandle } from "@edv4h/usketch-sync";
import { useEffect, useRef, useState } from "react";
import { type BoardRuntime, rememberLastPage } from "../lib/board-pages.js";
import { getErrorMessage } from "../lib/errors.js";
import { syncStatusStore } from "../lib/sync-status-store.js";
import {
	API_URL,
	devHeaders,
	type HostOptions,
	type HostUser,
	type HostWiring,
} from "./host-wiring.js";
import { createCatalogPlugins } from "./plugin-catalog.js";

export interface PageAppOptions {
	board: BoardRuntime | null;
	/**
	 * 開くページ。ページを使わないボードは null（ルートの shapes を開く）。
	 * undefined はまだ決まっていない（ページ一覧を読み終えるまで待つ）。
	 */
	pageId: string | null | undefined;
	/** ページに入れるプラグイン（カタログの id、ベースを除く）。 */
	plugins: ReadonlySet<string>;
	/** 以下は App を作るときに最新の値を読む（変わっても App は作り直さない）。 */
	host: HostOptions;
	user: HostUser;
	switchPage: (pageId: string) => void;
	/** カタログの外のプラグイン（開発用の場面など）。HUD より前に足す。 */
	extraPlugins?: () => UsketchPlugin[];
	/** App ができた直後に呼ぶ（地形を置く・ウィンドウシステムを有効にする など）。 */
	onCreated?: (app: AppInstance, wiring: HostWiring) => void;
}

/** 最後に開き終えたページと、そこまでの時間（ms）。 */
export interface LastOpen {
	pageId: string | null;
	ms: number;
}

/**
 * 開くページ（ページを使わないボードはルートの shapes）ごとに BoardStore と App（プラグイン）を
 * 作る。ページを切り替えると作り直し、ボードの接続はそのまま使う。
 *
 * React は cleanup を宣言順に走らせるので、`useBoardConnection` より前に呼ぶと、ボードを
 * 閉じるときに接続より先に App を壊せる。
 */
export function usePageApp(options: PageAppOptions): {
	app: AppInstance | null;
	error: string | null;
	/** 最後に開き終えたページ（開発用のコンソールから読む）。 */
	lastOpen: { readonly current: LastOpen | null };
} {
	const { board, pageId } = options;
	const [app, setApp] = useState<AppInstance | null>(null);
	const [error, setError] = useState<string | null>(null);
	const lastOpenRef = useRef<LastOpen | null>(null);
	// App を作るときに読むもの。effect の依存に入れると、ログインや URL が変わるたびに
	// App（undo の履歴・接続）が作り直されてしまう。
	const latest = useRef(options);
	latest.current = options;
	const pluginsKey = [...options.plugins].sort().join(",");

	// biome-ignore lint/correctness/useExhaustiveDependencies: プラグインの集合は pluginsKey で見る（Set は毎回新しい）
	useEffect(() => {
		if (!board || pageId === undefined) return;

		let cancelled = false;
		let instance: AppInstance | null = null;
		const startedAt = performance.now();
		const store = createBoardStore();
		const { rootDoc } = board;
		const pageHandle = pageId ? board.pageDocs.open(pageId) : null;
		// store が紐づく doc。ページを使うボードはページ doc、使わないボードはルート doc。
		const shapesDoc = pageHandle?.doc ?? rootDoc;
		if (pageId) rememberLastPage(board.boardId, pageId);
		// プラグインには「同じページの人だけが見える」provider を渡す（ページ無しなら元のまま）。
		const scopedProvider =
			board.wsProvider && pageId ? createPageScopedProvider(board.wsProvider, pageId) : null;
		const wsProvider: WsProviderHandle | null = scopedProvider ?? board.wsProvider;
		let syncHandle: YjsSyncHandle | null = null;
		// サーバーがまだ受け取っていない Shape を出す（つないでいるボードだけ）。
		let divergenceHandle: DivergenceTrackerHandle | null = null;
		const disposers: (() => void)[] = [];

		const wiring: HostWiring = {
			board,
			boardId: board.boardId,
			pageId,
			store,
			wsProvider,
			apiUrl: API_URL,
			extraHeaders: devHeaders(),
			user: () => latest.current.user,
			switchPage: (id) => latest.current.switchPage(id),
			get host() {
				return latest.current.host;
			},
			onDispose: (dispose) => {
				disposers.push(dispose);
			},
		};

		(async () => {
			try {
				await pageHandle?.whenLoaded;
				if (cancelled) return;

				// store を埋める前に作り、復元した Shape はサーバーが認めるまで「未確認」にする。
				if (board.wsProvider) {
					const ws = board.wsProvider;
					divergenceHandle = createDivergenceTracker({
						store,
						doc: shapesDoc,
						shapesMap: shapesDoc.getMap<Record<string, unknown>>("shapes"),
						onConnectionStatusChange: (handler) => ws.onStatusChange(handler),
					});
				}
				// store と shapes を紐づける。保存と同期はボード単位で張ってあるので persist: false。
				syncHandle = createYjsSync(store, { doc: shapesDoc, persist: false });
				syncStatusStore.setTracker(divergenceHandle?.status ?? syncHandle.status);
				await syncHandle.whenSynced;
				if (cancelled) return;

				const plugins = await createCatalogPlugins(
					options.plugins,
					wiring,
					latest.current.extraPlugins?.() ?? [],
				);
				if (cancelled) return;
				const created = await createApp({
					store,
					plugins,
					keymap: { warnConflicts: import.meta.env.DEV },
					// 開発中だけ: `?readonly` を付けると見るだけの人として開く（権限は R3b でつなぐ）。
					readOnly: import.meta.env.DEV && new URLSearchParams(location.search).has("readonly"),
				});
				if (cancelled) {
					created.destroy();
					return;
				}
				instance = created;
				const a = created;
				a.layers.register({
					id: "transient",
					order: 100,
					render: (renderCtx) => <TransientLayer registry={a.transient} ctx={renderCtx} />,
				});
				if (divergenceHandle) {
					const tracker = divergenceHandle.status;
					a.layers.register({
						id: "unconfirmed-shapes-overlay",
						order: 250,
						fixed: true,
						render: (renderCtx) => (
							<UnconfirmedOverlay
								store={a.store}
								shapes={a.shapes}
								viewport={renderCtx.viewport}
								syncStatus={tracker}
							/>
						),
					});
				}
				// 画面のフィルターが頼む「区画」の読み込みを、接続と同期へ渡す。
				if (wsProvider && syncHandle) {
					const wp = wsProvider;
					const sh = syncHandle;
					a.events.on<{ partitions: string[] }>("partition:request", (data) => {
						wp.requestPartition(data.partitions);
						for (const name of data.partitions) sh.loadPartition(name);
					});
					a.events.on<{ partitions: string[] }>("partition:unload", (data) => {
						for (const name of data.partitions) sh.unloadPartition(name);
					});
				}

				latest.current.onCreated?.(a, wiring);
				setApp(a);
				// ページの切替時間（App の作り直しまで含む）。重いプラグインで遅くなっていないかを
				// 見るため、開発中はコンソールに出す。
				const ms = Math.round(performance.now() - startedAt);
				lastOpenRef.current = { pageId, ms };
				if (import.meta.env.DEV && pageId) console.info(`[pages] opened ${pageId} in ${ms}ms`);
			} catch (e) {
				if (!cancelled) setError(getErrorMessage(e, "Failed to initialize board"));
			}
		})();

		return () => {
			cancelled = true;
			instance?.destroy();
			for (const dispose of disposers) dispose();
			scopedProvider?.dispose();
			divergenceHandle?.destroy();
			syncHandle?.destroy();
			pageHandle?.release();
			syncStatusStore.setTracker(null);
			setApp(null);
		};
	}, [board, pageId, pluginsKey]);

	return { app, error, lastOpen: lastOpenRef };
}
