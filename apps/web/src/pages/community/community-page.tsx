import { AppProvider, Canvas, TransientLayer } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { createDomRendererPlugin } from "@edv4h/usketch-dom-renderer";
import { createActivityFeedPlugin } from "@edv4h/usketch-plugin-activity-feed";
import { createAvatarPlugin } from "@edv4h/usketch-plugin-avatar";
import { createDotsBgPlugin } from "@edv4h/usketch-plugin-bg-dots";
import { createGridBgPlugin } from "@edv4h/usketch-plugin-bg-grid";
import { createBoardInfoPanelPlugin } from "@edv4h/usketch-plugin-board-info-panel";
import { createFilterPlugin } from "@edv4h/usketch-plugin-canvas-filter";
import {
	AWARENESS_FIELD as CHARACTER_AWARENESS_FIELD,
	createCharacterPlugin,
} from "@edv4h/usketch-plugin-character";
import { createCommentsPlugin } from "@edv4h/usketch-plugin-comments";
import { createCommunityChatPlugin } from "@edv4h/usketch-plugin-community-chat";
import { createDebugHudPlugin } from "@edv4h/usketch-plugin-debug-hud";
import { createRippleEffectPlugin } from "@edv4h/usketch-plugin-effect-ripple";
import { createElevationPlugin } from "@edv4h/usketch-plugin-elevation";
import { createFollowMePlugin } from "@edv4h/usketch-plugin-follow-me";
import { createHistoryPlugin } from "@edv4h/usketch-plugin-history";
import { createKeySettingsPlugin } from "@edv4h/usketch-plugin-key-settings";
import { createKeyboardShortcutsPlugin } from "@edv4h/usketch-plugin-keyboard-shortcuts";
import { createMapPlugin } from "@edv4h/usketch-plugin-map";
import { createMode7Plugin } from "@edv4h/usketch-plugin-mode7";
import { createPresenceCursorPlugin } from "@edv4h/usketch-plugin-presence-cursor";
import { createReactionsPlugin } from "@edv4h/usketch-plugin-reactions";
import { createShape3dPlugin } from "@edv4h/usketch-plugin-shape-3d";
import {
	type BoardPortalShapeData,
	createBoardPortalPlugin,
} from "@edv4h/usketch-plugin-shape-board-portal";
import { createGroupPlugin } from "@edv4h/usketch-plugin-shape-group";
import { createSidePanelPlugin } from "@edv4h/usketch-plugin-side-panel";
import { createSpatialChatPlugin } from "@edv4h/usketch-plugin-spatial-chat";
import { createSpotlightPlugin } from "@edv4h/usketch-plugin-spotlight";
import { createStartPositionPlugin } from "@edv4h/usketch-plugin-start-position";
import {
	createYjsSync,
	persistDocToIndexedDb,
	type YjsSyncHandle,
} from "@edv4h/usketch-plugin-sync-localstorage-yjs";
import { createPanToolPlugin } from "@edv4h/usketch-plugin-tool-pan";
import { createSelectToolPlugin } from "@edv4h/usketch-plugin-tool-select";
import { createViewportNavPlugin } from "@edv4h/usketch-plugin-viewport-nav";
import { createVotingPlugin } from "@edv4h/usketch-plugin-voting";
import { createWhistlePlugin } from "@edv4h/usketch-plugin-whistle";
import type { UsketchPlugin } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import {
	createPageDocManager,
	createPageScopedProvider,
	createWsProvider,
	isPagedBoard,
	listPages,
	observePages,
	type PageDocManager,
	type WsProviderHandle,
} from "@edv4h/usketch-sync";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import * as Y from "yjs";
import { api } from "../../lib/api.js";
import { pageDocName } from "../../lib/board-pages.js";
import {
	characterAppearance,
	renderCharacter,
	renderCharacterShadow,
} from "../../lib/character-renderer.js";
import { getDevUser } from "../../lib/dev-auth.js";
import { getErrorMessage } from "../../lib/errors.js";
import { useAuth } from "../../lib/use-auth.js";
import { useCommunityActions } from "../../lib/use-community-actions.js";
import { useKeyboardShortcuts } from "../../lib/use-keyboard-shortcuts.js";
import { CommunityHeader } from "./community-header.js";
import { ensureRegionTerrain } from "./community-terrain.js";
import { stockTerritoryStyle } from "./map-territory-style.js";

/** 地域のボードへの接続。ボードを開いている間ずっと生かし、開くページが変わっても作り直さない。 */
interface CommunityBoard {
	boardId: string;
	rootDoc: Y.Doc;
	wsProvider: WsProviderHandle | null;
	pageDocs: PageDocManager;
}

/** 開くページ。ページを使うボード（マルチページ移行後）は先頭ページ、使わないボードは null。 */
interface PageState {
	paged: boolean;
	pageId: string | null;
}

export function CommunityPage() {
	const { slug } = useParams<{ slug: string }>();
	const navigate = useNavigate();
	const { user: authUser } = useAuth();
	const authUserId = authUser?.id ?? null;
	const authUserName = authUser?.name ?? null;
	const authUserImage = authUser?.image ?? null;
	const [app, setApp] = useState<AppInstance | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [regionName, setRegionName] = useState<string>("");
	const [board, setBoard] = useState<CommunityBoard | null>(null);
	const [pageState, setPageState] = useState<PageState | null>(null);
	const pagesReady = pageState !== null;
	const paged = pageState?.paged ?? false;
	const pageId = pageState?.pageId ?? null;

	// ページ単位: 開くページ（ページを使わないボードはルートの shapes）ごとに BoardStore と App を
	// 作り直す。React は cleanup を宣言順に走らせるので、ボード単位の effect より前に置いて、
	// ボードを閉じるときは接続より先に App を壊す。
	useEffect(() => {
		if (!slug || !board || !pagesReady) return;
		if (paged && !pageId) return;

		let cancelled = false;
		let instance: AppInstance | null = null;
		const store = createBoardStore();
		const { boardId, rootDoc, pageDocs } = board;
		const pageHandle = pageId ? pageDocs.open(pageId) : null;
		// store が紐づく doc。ページを使うボードはページ doc、使わないボードはルート doc。
		const shapesDoc = pageHandle?.doc ?? rootDoc;
		// ページを使うボードでは、カーソル・アバター・キャラなどを同じページの人だけに絞る。
		const scopedProvider =
			board.wsProvider && pageId ? createPageScopedProvider(board.wsProvider, pageId) : null;
		const wsProvider: WsProviderHandle | null = scopedProvider ?? board.wsProvider;
		let syncHandle: YjsSyncHandle | null = null;
		const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

		(async () => {
			try {
				await pageHandle?.whenLoaded;
				if (cancelled) return;
				syncHandle = createYjsSync(store, { doc: shapesDoc, persist: false });

				const extraPlugins: UsketchPlugin[] = [];

				// コミュニティ空間にはboard-portalシェイプ + コミュニケーション系プラグインのみ
				const portalPlugin = createBoardPortalPlugin({
					onPortalOpen: (portalBoardId) => {
						navigate(`/boards/${portalBoardId}`);
					},
					onPortalCreate: async (shapeId, _position, isPublic) => {
						try {
							const board = await api.boards.create("New Board");
							if (isPublic) {
								await api.boards.update(board.id, { isPublic: true });
							}
							store.updateShape(shapeId, {
								boardId: board.id,
								boardTitle: board.title,
								ownerName: authUserName ?? "",
								ownerImage: authUserImage ?? "",
								isPublic,
							} as Partial<BoardPortalShapeData>);
						} catch (e) {
							console.error("Failed to create board:", e);
							store.deleteShape(shapeId);
						}
					},
				});

				// Cloud sync（認証済みの場合。接続はボード単位の effect が持つ）
				if (wsProvider && authUserId) {
					extraPlugins.push(createRippleEffectPlugin(wsProvider));
					extraPlugins.push(createReactionsPlugin(wsProvider));
					extraPlugins.push(createSpatialChatPlugin(wsProvider));
					extraPlugins.push(createVotingPlugin(wsProvider));
					extraPlugins.push(createSpotlightPlugin(wsProvider));
					extraPlugins.push(createFollowMePlugin({ wsProvider }));
					extraPlugins.push(
						createPresenceCursorPlugin({
							wsProvider,
							userId: authUserId ?? "anonymous",
							userName: authUserName ?? "Anonymous",
						}),
					);
					extraPlugins.push(
						createAvatarPlugin({
							wsProvider,
							userId: authUserId ?? "anonymous",
							userName: authUserName ?? "Anonymous",
							userImage: authUserImage,
							// 操作キャラが出ている間はキャラが本人の表示なので、アバターは重ねない。
							hideAvatar: (state) => state[CHARACTER_AWARENESS_FIELD] != null,
						}),
					);
					// サイドパネル + ボード情報パネル + コメント
					// SidePanel プラグインは `side-panel:register-tab` イベントを listen するため、
					// タブを登録する側のプラグインより先に setup されている必要がある。
					extraPlugins.push(createSidePanelPlugin());
					extraPlugins.push(
						createActivityFeedPlugin({
							wsProvider,
							boardId,
							apiUrl,
						}),
					);
					const infoHeaders: Record<string, string> = {};
					if (import.meta.env.DEV) {
						const devUser = getDevUser();
						if (devUser) infoHeaders["X-User-Id"] = devUser.id;
					}
					extraPlugins.push(
						createBoardInfoPanelPlugin({
							apiUrl,
							extraHeaders: Object.keys(infoHeaders).length > 0 ? infoHeaders : undefined,
							onOpenBoard: (openBoardId: string) => {
								navigate(`/boards/${openBoardId}`);
							},
						}),
					);

					extraPlugins.push(
						createCommentsPlugin({
							boardId,
							apiUrl,
							extraHeaders: Object.keys(infoHeaders).length > 0 ? infoHeaders : undefined,
						}),
					);

					extraPlugins.push(
						createCommunityChatPlugin({
							apiUrl: `${apiUrl}/api/boards/${boardId}/chat`,
							extraHeaders: Object.keys(infoHeaders).length > 0 ? infoHeaders : undefined,
							wsProvider,
							userId: authUserId,
							userName: authUserName ?? "Anonymous",
						}),
					);
					extraPlugins.push(createKeyboardShortcutsPlugin({ wsProvider }));
					extraPlugins.push(createWhistlePlugin(wsProvider));
					extraPlugins.push(createFilterPlugin());
					// ボード履歴（一覧・差分・プレビュー・復元）。旧 Time Travel の置き換え。
					extraPlugins.push(
						createHistoryPlugin({
							boardId,
							apiUrl,
							extraHeaders: Object.keys(infoHeaders).length > 0 ? infoHeaders : undefined,
						}),
					);
				} else {
					extraPlugins.push(createRippleEffectPlugin());
					extraPlugins.push(createReactionsPlugin());
					extraPlugins.push(createSpatialChatPlugin());
					extraPlugins.push(createVotingPlugin());
					extraPlugins.push(createSpotlightPlugin());
					extraPlugins.push(createKeyboardShortcutsPlugin());
					extraPlugins.push(createWhistlePlugin());
					extraPlugins.push(createFilterPlugin());
				}

				// 操作キャラ（WASD）: 接続中は awareness で他ユーザーのキャラと共存。
				// 見た目はプラグインに持たせず、ホストの renderer を注入。
				extraPlugins.push(
					createCharacterPlugin({
						wsProvider: wsProvider ?? undefined,
						userName: authUserName ?? undefined,
						appearance: characterAppearance(authUserId ?? getDevUser()?.id ?? "local"),
						renderCharacter,
						renderShadow: renderCharacterShadow,
						// 標高の坂: これより急な坂は登れずずり落ちる（web アプリのボードと同じ値）。
						motion: { maxSlope: 45 },
					}),
				);

				const basePlugins: UsketchPlugin[] = [
					createGridBgPlugin(),
					createDotsBgPlugin(),
					createSelectToolPlugin(),
					createPanToolPlugin(),
					createViewportNavPlugin(),
					portalPlugin,
					createGroupPlugin(),
					// Demo default: unset tiles read as sea, so the world map is an
					// infinite ocean with painted land (off-map counts as water). The map
					// plugin is headless for territory — the demo app owns the look via
					// `stockTerritoryStyle` (the reference fill/border/ring + label).
					createMapPlugin({ emptyTerrain: "water", territory: stockTerritoryStyle }),
					// 標高（連続した高さの地形）。場（elevation-field）のあるボードだけで働き、
					// そのあいだ地面の高さは map の段ではなく標高になる。標高マップの地域
					// （community-terrain.ts）は無限地形を自動で用意し、ほかの地域も HUD「標高」で作れる。
					createElevationPlugin(),
					// マップの初期視点（スタート位置）を HUD で設定・起動時移動。
					createStartPositionPlugin(),
					// Mode 7（擬似3D）。マップの地形が高さ（地形の種類で決まる段）ごとに崖として
					// 立ち上がり、キャラもその上に乗る。既定 OFF、HUD「3Dビュー切替」で切替。
					createMode7Plugin({ transition: { durationMs: 900 } }),
					// 全プラグインのキーを 1 つの HUD「キー設定」で一覧・付け替え。
					createKeySettingsPlugin(),
					// Mode 7 中に Shape を立てる（HUD「3D（選択中の Shape）」で 1 つずつ指定）。
					// ボードポータルは指定しなくても立つ（ゲートとして見えるように）。
					createShape3dPlugin({ types: { "board-portal": { default: { mode: "stand" } } } }),
					createDomRendererPlugin(),
					// Control HUD: hosts plugin operations/settings + the useCommunityActions
					// actions (toggle with the backtick key). Replaces bespoke on-canvas UI.
					createDebugHudPlugin(),
				];

				await syncHandle.whenSynced;
				if (cancelled) return;

				const plugins = [...basePlugins, ...extraPlugins];
				const created = await createApp({
					store,
					plugins,
					keymap: { warnConflicts: import.meta.env.DEV },
				});
				if (cancelled) {
					created.destroy();
					return;
				}
				instance = created;
				const a = instance;
				a.layers.register({
					id: "transient",
					order: 100,
					render: (renderCtx) => <TransientLayer registry={a.transient} ctx={renderCtx} />,
				});

				// 標高マップの地域なら、ボードに場が無いときだけ無限地形を置く。接続している人は
				// ページ doc を開けてから（サーバーの中身を読んでから）にする。移行前のルートに
				// 置くと、サーバーが 1 枚目へ移すときに誰かが変えた地形を上書きしかねないため。
				if (!board.wsProvider || pageId) ensureRegionTerrain(store, slug);

				// Partition request relay: filter plugin → wsProvider → syncHandle
				if (wsProvider && syncHandle) {
					const wp = wsProvider;
					const sh = syncHandle;
					a.events.on<{ partitions: string[] }>("partition:request", (data) => {
						wp.requestPartition(data.partitions);
						for (const name of data.partitions) {
							sh.loadPartition(name);
						}
					});
					a.events.on<{ partitions: string[] }>("partition:unload", (data) => {
						for (const name of data.partitions) {
							sh.unloadPartition(name);
						}
					});
				}

				setApp(instance);
			} catch (e) {
				if (!cancelled) {
					setError(getErrorMessage(e, "Failed to initialize community"));
				}
			}
		})();

		return () => {
			cancelled = true;
			instance?.destroy();
			syncHandle?.destroy();
			scopedProvider?.dispose();
			pageHandle?.release();
			setApp(null);
		};
	}, [slug, board, pagesReady, paged, pageId, authUserId, authUserName, authUserImage, navigate]);

	// ボード単位: slug → boardId を引き、ルート doc・IndexedDB・WebSocket・ページ doc の管理役を
	// 作る。マルチページ移行後のボードはルートの shapes が空なので、ページ一覧を見て先頭ページを開く
	// （サーバーから版が届いてページを使うボードだと分かった時点で、ページ単位の effect が開き直す）。
	useEffect(() => {
		if (!slug) return;

		let cancelled = false;
		let close: (() => void) | null = null;
		const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

		(async () => {
			try {
				const res = await fetch(`${apiUrl}/api/community-boards/${slug}`);
				if (!res.ok) throw new Error("Community board not found");
				const regionData = await res.json();
				const boardId: string = regionData.boardId;
				if (cancelled) return;
				setRegionName(regionData.displayName);

				const rootDoc = new Y.Doc();
				// ルートの保存先は、ルートの shapes だけを見ていた頃と同じ名前（手元の保存を引き継ぐ）。
				const rootPersistence = persistDocToIndexedDb(`usketch-community-${boardId}`, rootDoc);
				let wsProvider: WsProviderHandle | null = null;
				if (authUserId) {
					let wsUrl = `${apiUrl.replace(/^http/, "ws")}/api/boards/${boardId}/ws`;
					if (import.meta.env.DEV) {
						const devUser = getDevUser();
						if (devUser) {
							wsUrl += `?devUserId=${encodeURIComponent(devUser.id)}`;
						}
					}
					wsProvider = createWsProvider({ url: wsUrl, doc: rootDoc });
				}
				const pageDocs = createPageDocManager({
					provider: wsProvider,
					persist: (id, doc) => persistDocToIndexedDb(pageDocName(boardId, id), doc),
				});
				const readPages = () => {
					const isPaged = isPagedBoard(rootDoc);
					const first = isPaged ? (listPages(rootDoc)[0]?.id ?? null) : null;
					setPageState((prev) =>
						prev?.paged === isPaged && prev.pageId === first
							? prev
							: { paged: isPaged, pageId: first },
					);
				};
				const offPages = observePages(rootDoc, readPages);
				close = () => {
					offPages();
					pageDocs.destroy();
					wsProvider?.destroy();
					rootPersistence.destroy();
					rootDoc.destroy();
				};

				await rootPersistence.whenSynced;
				if (cancelled) return;
				readPages();
				setBoard({ boardId, rootDoc, wsProvider, pageDocs });
			} catch (e) {
				if (!cancelled) {
					setError(getErrorMessage(e, "Failed to initialize community"));
				}
			}
		})();

		return () => {
			cancelled = true;
			close?.();
			setBoard(null);
			setPageState(null);
		};
	}, [slug, authUserId]);

	// キーボードショートカット
	useKeyboardShortcuts(app);
	// 横断アクションを Control HUD に登録（旧ヘッダー右ボタン群の代替）
	useCommunityActions(app, !!authUserId);

	if (error) {
		return (
			<div
				style={{
					padding: 24,
					fontFamily: "var(--font-sans)",
					color: "var(--danger)",
					background: "var(--bg-canvas)",
					minHeight: "100vh",
				}}
			>
				<p>Error: {error}</p>
			</div>
		);
	}

	if (!app) return null;

	return (
		<AppProvider app={app}>
			<div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
				<Canvas />
				{/* コミュニティヘッダー */}
				<CommunityHeader regionName={regionName} />
			</div>
		</AppProvider>
	);
}
