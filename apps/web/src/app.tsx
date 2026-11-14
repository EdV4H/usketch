import { createValuesCardConfig, type ValuesCardState } from "@edv4h/croupier-plugin-values-card";
import { AppProvider, Canvas, TransientLayer } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { createCss3dRendererPlugin } from "@edv4h/usketch-css3d-renderer";
import { createDomRendererPlugin } from "@edv4h/usketch-dom-renderer";
import { createGpuRendererPlugin } from "@edv4h/usketch-gpu-renderer";
import { createGpu3dRendererPlugin } from "@edv4h/usketch-gpu3d-renderer";
import { createActivityFeedPlugin } from "@edv4h/usketch-plugin-activity-feed";
import { createAiActionsPlugin } from "@edv4h/usketch-plugin-ai-actions";
import { createAiAgentPlugin } from "@edv4h/usketch-plugin-ai-agent";
import { createAiChatPlugin } from "@edv4h/usketch-plugin-ai-chat";
import { createAiCopilotPlugin } from "@edv4h/usketch-plugin-ai-copilot";
import { createAiImagePlugin } from "@edv4h/usketch-plugin-ai-image";
import { createAiRecognizePlugin } from "@edv4h/usketch-plugin-ai-recognize";
import { createAssetStorePlugin } from "@edv4h/usketch-plugin-asset-store";
import { createDotsBgPlugin } from "@edv4h/usketch-plugin-bg-dots";
import { createGridBgPlugin } from "@edv4h/usketch-plugin-bg-grid";
import { createCharacterPlugin } from "@edv4h/usketch-plugin-character";
import { createCommentsPlugin } from "@edv4h/usketch-plugin-comments";
import { createAttachablePlugin, createContainerPlugin } from "@edv4h/usketch-plugin-container";
import {
	createAwarenessPresence,
	createCroupierPlugin,
	createMapGameState,
	defineCroupierGame,
} from "@edv4h/usketch-plugin-croupier";
import { createDashboardPlugin } from "@edv4h/usketch-plugin-dashboard";
import { createDeepLinkPlugin } from "@edv4h/usketch-plugin-deep-link";
import { createDomainDesignPlugin } from "@edv4h/usketch-plugin-domain-design";
import { createEdgePanPlugin } from "@edv4h/usketch-plugin-edge-pan";
import { createElevationPlugin } from "@edv4h/usketch-plugin-elevation";
import { createExportPlugin, type ExportPluginOptions } from "@edv4h/usketch-plugin-export";
import { createFollowMePlugin } from "@edv4h/usketch-plugin-follow-me";
import { createFreePositionPlugin } from "@edv4h/usketch-plugin-free-position";
import { createHistoryPlugin } from "@edv4h/usketch-plugin-history";
import { createKeySettingsPlugin } from "@edv4h/usketch-plugin-key-settings";
import { createLaserPlugin } from "@edv4h/usketch-plugin-laser";
import { createMarkdownToShapePlugin } from "@edv4h/usketch-plugin-markdown-to-shape";
import { createMode7Plugin } from "@edv4h/usketch-plugin-mode7";
import { createPagesPlugin, neighborPage } from "@edv4h/usketch-plugin-pages";
import { createPdfImportPlugin } from "@edv4h/usketch-plugin-pdf-import";
import { createPortalPlugin } from "@edv4h/usketch-plugin-portal";
import { createPresenceActivityPlugin } from "@edv4h/usketch-plugin-presence-activity";
import { createPresenceCursorPlugin } from "@edv4h/usketch-plugin-presence-cursor";
import { createPresenceEnhancedPlugin } from "@edv4h/usketch-plugin-presence-enhanced";
import { createPresentationPlugin } from "@edv4h/usketch-plugin-presentation";
import { createScatterPlugin } from "@edv4h/usketch-plugin-scatter";
import { createSessionPlugin } from "@edv4h/usketch-plugin-session";
import { createShape3dPlugin } from "@edv4h/usketch-plugin-shape-3d";
import { createBasicShapePlugin } from "@edv4h/usketch-plugin-shape-basic";
import { createCardPlugin, EXAMPLE_CARD_TYPES } from "@edv4h/usketch-plugin-shape-card";
import { createConnectorPlugin } from "@edv4h/usketch-plugin-shape-connector";
import { createCounterPlugin } from "@edv4h/usketch-plugin-shape-counter";
import { createEmbedShapePlugin } from "@edv4h/usketch-plugin-shape-embed";
import { createFramePlugin } from "@edv4h/usketch-plugin-shape-frame";
import { createFreedrawPlugin } from "@edv4h/usketch-plugin-shape-freedraw";
import { createGroupPlugin } from "@edv4h/usketch-plugin-shape-group";
import { createImageShapePlugin } from "@edv4h/usketch-plugin-shape-image";
import { createMarkdownPlugin } from "@edv4h/usketch-plugin-shape-markdown";
import { createOpenUIShapePlugin } from "@edv4h/usketch-plugin-shape-openui";
import { createStickyPlugin } from "@edv4h/usketch-plugin-shape-sticky";
import { createTextPlugin } from "@edv4h/usketch-plugin-shape-text";
import { createWireframePlugin } from "@edv4h/usketch-plugin-shape-wireframe";
import { createSidePanelPlugin } from "@edv4h/usketch-plugin-side-panel";
import { createSnapPlugin } from "@edv4h/usketch-plugin-snap";
import { createSpotlightPlugin } from "@edv4h/usketch-plugin-spotlight";
import { createStartPositionPlugin } from "@edv4h/usketch-plugin-start-position";
import {
	createYjsSync,
	persistDocToIndexedDb,
	type YjsSyncHandle,
} from "@edv4h/usketch-plugin-sync-localstorage-yjs";
import {
	createDivergenceTracker,
	type DivergenceTrackerHandle,
	UnconfirmedOverlay,
} from "@edv4h/usketch-plugin-sync-ywebsocket";
import { createTimterPlugin } from "@edv4h/usketch-plugin-timter";
import {
	createOpenUIToolPlugin,
	createServerProxyProvider,
} from "@edv4h/usketch-plugin-tool-openui";
import { createPanToolPlugin } from "@edv4h/usketch-plugin-tool-pan";
import { createSelectToolPlugin } from "@edv4h/usketch-plugin-tool-select";
import { createVimToolPlugin } from "@edv4h/usketch-plugin-tool-vim";
import { createViewportNavPlugin } from "@edv4h/usketch-plugin-viewport-nav";
import {
	createVoiceNotesPlugin,
	createWhisperTranscriber,
} from "@edv4h/usketch-plugin-voice-notes";
import { createWhistlePlugin } from "@edv4h/usketch-plugin-whistle";
import { createWindowSystemPlugin, getWindowSystemApi } from "@edv4h/usketch-plugin-window-system";
import { votingClientType } from "@edv4h/usketch-session-voting/client";
import type { ShapeData, UsketchPlugin } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import {
	createPage,
	createPageDocManager,
	createPageScopedProvider,
	createServerClock,
	createWsProvider,
	getLegacyPageId,
	getPage,
	initPagedBoard,
	isPagedBoard,
	listPages,
	observePages,
	PAGE_SHAPES_MAP_KEY,
	resolvePageId,
	type WsConnectionStatus,
	type WsProviderHandle,
} from "@edv4h/usketch-sync";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router";
import * as Y from "yjs";
import { CopilotPill } from "./components/board-frame/index.js";
import { ShareDialog } from "./components/share-dialog.js";
import { InfoTab } from "./components/side-panel/info-tab.js";
import { boardMetaStore } from "./lib/board-meta-store.js";
import {
	type BoardRuntime,
	type PagesState,
	pageDocName,
	pageSearch,
	readLastPage,
	readRequestedPage,
	rememberLastPage,
} from "./lib/board-pages.js";
import {
	characterAppearance,
	renderCharacter,
	renderCharacterShadow,
} from "./lib/character-renderer.js";
import { getDevUser } from "./lib/dev-auth.js";
import { getErrorMessage } from "./lib/errors.js";
import { localBoards } from "./lib/local-boards.js";
import { migrateLocalBoard } from "./lib/local-pages-migration.js";
import { presenceStore, readPresenceMembers } from "./lib/presence-store.js";
import { computePresentStage, type StageRect } from "./lib/present-stage.js";
import { loadViewportCull, loadViewportLod } from "./lib/render-settings.js";
import { syncStatusStore } from "./lib/sync-status-store.js";
import { useAppActions } from "./lib/use-app-actions.js";
import { useAuth } from "./lib/use-auth.js";
import { useKeyboardShortcuts } from "./lib/use-keyboard-shortcuts.js";
import { createBoardMetaPanelPlugin } from "./plugins/board-meta-panel.js";
import { createCompare3dPlugin, readCompare3dScene } from "./plugins/compare-3d.js";
import { createMarkdownAdaptersPlugin } from "./plugins/markdown-adapters.js";
import { createPresencePanelPlugin } from "./plugins/presence-panel.js";
import { createSyncStatusPanelPlugin } from "./plugins/sync-status-panel.js";
import { createViewportLodControlPlugin } from "./plugins/viewport-lod-control.js";

type PresentationMode = "off" | "edit" | "present";

/**
 * URL から現在のプレゼンテーション状態を読む。
 * - `?present=1` があれば edit（発表オフ時のプレゼン編集モード）
 * - `?present=1&mode=present` があれば present（発表中）
 * - いずれも無ければ off（通常のホワイトボード）
 */
function readPresentationMode(search: string): PresentationMode {
	const params = new URLSearchParams(search);
	if (params.get("present") !== "1") return "off";
	return params.get("mode") === "present" ? "present" : "edit";
}

/**
 * `?desktop=1` があれば、このボードを「デスクトップ」として開く — window-system
 * プラグインを既定で有効化する（コミュニティページの「デスクトップを追加」で作成した
 * ボードに付く）。有効化で config シェイプが作られ shape として永続化されるので、
 * 次回以降はフラグ無しでもデスクトップのまま。冪等（既存 config には作用しない）。
 */
function readDesktopTemplate(search: string): boolean {
	return new URLSearchParams(search).get("desktop") === "1";
}

/**
 * `?renderer3d=gpu` で 3D 表示を GPU レンダラー（WebGL2・実験中）で描く。既定は CSS 3D。
 * 2 つのレンダラーを同じボードで見比べるための切替（#1304）。
 */
function readRenderer3d(search: string): "css" | "gpu" {
	return new URLSearchParams(search).get("renderer3d") === "gpu" ? "gpu" : "css";
}

interface CardHandWiring {
	userId: string;
	boardId?: string;
	wsProvider?: WsProviderHandle | null;
}

function createBasePlugins(
	cardHand: CardHandWiring,
	exportOptions?: ExportPluginOptions,
): UsketchPlugin[] {
	return [
		createGridBgPlugin(),
		createDotsBgPlugin(),
		createSelectToolPlugin(),
		createPanToolPlugin(),
		createVimToolPlugin(undefined, {
			// Vim ↔ freedraw 連携。`:` コマンドでペン/色/太さ/消しゴムを操作し描画ツールへ。
			commands: {
				draw: (_args, api) => {
					api.store.setActiveToolId("freedraw-draw");
					return "draw";
				},
				pen: (args, api) => {
					const p = args[0];
					if (!["ballpoint", "felt", "brush", "highlighter"].includes(p)) {
						return "E: :pen ballpoint|felt|brush|highlighter";
					}
					api.events.emit("freedraw:set-pen", { pen: p });
					api.store.setActiveToolId("freedraw-draw");
					return `pen ${p}`;
				},
				color: (args, api) => {
					if (!args[0]) return "E: :color #RRGGBB";
					api.events.emit("freedraw:set-color", { color: args[0] });
					api.store.setActiveToolId("freedraw-draw");
					return `color ${args[0]}`;
				},
				pensize: (args, api) => {
					const n = Number(args[0]);
					if (!Number.isFinite(n)) return "E: :pensize <n>";
					api.events.emit("freedraw:set-size", { size: n });
					return `size ${n}`;
				},
				eraser: (_args, api) => {
					api.events.emit("freedraw:toggle-eraser", {});
					api.store.setActiveToolId("freedraw-draw");
					return "eraser";
				},
			},
		}),
		createViewportNavPlugin(),
		createEdgePanPlugin(),
		createBasicShapePlugin(),
		createGroupPlugin(),
		createFramePlugin(),
		createConnectorPlugin({ freeEnds: true }),
		createFreedrawPlugin(),
		createTextPlugin(),
		createMarkdownPlugin(),
		createMarkdownToShapePlugin(),
		createMarkdownAdaptersPlugin(),
		createStickyPlugin(),
		createCardPlugin({
			cardTypes: EXAMPLE_CARD_TYPES,
			userId: cardHand.userId,
			boardId: cardHand.boardId,
			wsProvider: cardHand.wsProvider ?? undefined,
		}),
		createImageShapePlugin(),
		// PDF のペースト／ドロップを pdf-page シェイプの集合に展開する。アセット
		// ストア（extraPlugins 側で登録）を使うが lazy 解決なので登録順は問わない。
		// pdf.js のワーカーは実行コードなので CDN ではなく自前でバンドルして配信する。
		createPdfImportPlugin({ workerSrc: pdfWorkerUrl }),
		createCounterPlugin(),
		createWireframePlugin(),
		createDomainDesignPlugin(),
		createSnapPlugin(),
		createFreePositionPlugin(),
		createContainerPlugin(),
		createAttachablePlugin(),
		// ダッシュボード（sortable なグリッド）。container/free-position の後に置き、
		// during-drag reflow をトップレベル移動の最後の writer にする。autoCreate:false
		// で、メインボードを勝手にグリッド化せず、HUD の「ダッシュボード化」で opt-in。
		createDashboardPlugin({ autoCreate: false }),
		// ウィンドウシステム（画角固定 ＋ i3風タイル/自由配置）。dashboard と同じく
		// container/free-position の後・autoEnable:false で opt-in（HUD「ウィンドウ化」）。
		createWindowSystemPlugin({ autoEnable: false }),
		// 標高（連続した高さの地形）。HUD「標高 → 無限地形を作る・変える」で opt-in。
		// 地面の高さサービスを提供するので、キャラは坂を上り下りし、3D の Shape は丘に乗る。
		createElevationPlugin(),
		// 3D 表示の描画（既定は CSS 3D）。層を CSS の 3D 変形で傾けて地面にする。Mode 7 などの
		// 3D ビューはボードの 3D 表示の状態を変えるだけで、描くのはこのレンダラー。
		// `?renderer3d=gpu` なら WebGL2 の GPU レンダラー（実験中）で描く。
		readRenderer3d(typeof window !== "undefined" ? window.location.search : "") === "gpu"
			? createGpu3dRendererPlugin()
			: createCss3dRendererPlugin(),
		// Mode 7（擬似3D地平面ビュー）。板コンテンツ層を CSS 3D で傾けるビューモード。
		// 既定 OFF（HUD「3Dビュー切替」/ mode7:toggle で opt-in）。
		// 切替時は地面がせり上がり、空/フォグがフェードする（#1103）。
		createMode7Plugin({ transition: { durationMs: 900 } }),
		// 全プラグインのキーを 1 つの HUD「キー設定」で一覧・付け替え（閲覧者ごとに localStorage へ保存）。
		createKeySettingsPlugin(),
		// Mode 7 中に Shape を立てる（`x-shape-3d` を持つ Shape だけ。HUD「3D（選択中の Shape）」）。
		createShape3dPlugin(),
		// 関連Shapeを「ぶちまける」— HUD の「関連Shapeをぶちまける」アクション。connector/
		// container/free-position の後（関連解決 + 非重なり配置の土台が揃った後）。
		createScatterPlugin(),
		createExportPlugin(exportOptions),
		createGpuRendererPlugin(),
		createDomRendererPlugin({
			// Initial values from persisted user settings; live changes come from the
			// Control HUD (SET_VIEWPORT_LOD_EVENT / SET_VIEWPORT_CULL_EVENT).
			viewportLod: (() => {
				const s = loadViewportLod();
				return s.enabled ? { ratio: s.ratio } : false;
			})(),
			viewportCull: (() => {
				const s = loadViewportCull();
				return s.enabled ? { ratio: s.ratio } : false;
			})(),
		}),
		// Registers the viewport-LOD / culling toggles + % controls into the Control HUD.
		createViewportLodControlPlugin(),
		// Contributes the Board meta panel to the Control HUD (replaces the hardcoded
		// General-panel Board section + __usketchBoardMeta global).
		createBoardMetaPanelPlugin(),
		// Contributes the online-members (presence) panel (replaces the HUD Members
		// panel + __usketchPresence global). Fed by the awareness effect below.
		createPresencePanelPlugin(),
		// Contributes the sync/persistence status panel (replaces the HUD General
		// Persistence section + __usketchSyncStatus global). Fed by syncStatusStore.
		createSyncStatusPanelPlugin(),
	];
}

async function loadPlugins(
	extra: UsketchPlugin[],
	cardHand: CardHandWiring,
	exportOptions?: ExportPluginOptions,
): Promise<UsketchPlugin[]> {
	const plugins = [...createBasePlugins(cardHand, exportOptions), ...extra];
	// `?scene3d=hills|many|drive`: 3D レンダラーを比べる場面（#1304 P6c）。キャラ（extra）の後。
	const search = typeof window !== "undefined" ? window.location.search : "";
	const scene3d = readCompare3dScene(search);
	if (scene3d) plugins.push(createCompare3dPlugin(scene3d, readRenderer3d(search)));
	// Control HUD (universal plugin-operation panel). Promoted from DEV-only to a
	// first-class, always-available panel — hidden by default, toggled with `` ` ``.
	// Kept as a dynamic import so it stays code-split.
	const { createDebugHudPlugin } = await import("@edv4h/usketch-plugin-debug-hud");
	return [...plugins, createDebugHudPlugin()];
}

export function App() {
	const { boardId } = useParams<{ boardId: string }>();
	const location = useLocation();
	const navigate = useNavigate();
	const isCloudBoard = location.pathname.startsWith("/boards/");
	const presentationMode = readPresentationMode(location.search);
	const { user: authUser } = useAuth();

	// 最新の presentation mode を useEffect 外部から参照するための ref。
	// effect 依存に入れてしまうと ?present=1 切替のたびに app インスタンスが
	// 作り直され、undo 履歴や WebSocket が吹き飛ぶ。presentation plugin 側が
	// popstate で ref を読み直す設計。
	const modeRef = useRef<PresentationMode>(presentationMode);
	modeRef.current = presentationMode;

	// 「デスクトップを追加」で開かれたか（?desktop=1）。app 再生成を避けるため ref で保持し、
	// 初期化 effect の依存には入れない（present と同様、URL クエリで app を作り直さない）。
	const desktopTemplateRef = useRef<boolean>(readDesktopTemplate(location.search));
	desktopTemplateRef.current = readDesktopTemplate(location.search);

	// 最新のユーザー id を board-init effect の依存に入れずに参照するための ref
	// （modeRef と同じ理由: 依存に入れると auth 解決のたびに board が作り直される）。
	// 手札(hand)のローカル保持キー / awareness 枚数共有の userId に使う。
	const userIdRef = useRef<string | undefined>(authUser?.id);
	userIdRef.current = authUser?.id;
	const userNameRef = useRef<string | undefined>(authUser?.name);
	userNameRef.current = authUser?.name;

	// react-router の navigate() は pushState ベースで popstate を発火しない。
	// presentation plugin は popstate で modeRef を再読込する設計なので、
	// ?present= の変化を検出したら明示的に popstate を dispatch する。
	// biome-ignore lint/correctness/useExhaustiveDependencies: presentationMode の変化をトリガーとして使用
	useEffect(() => {
		window.dispatchEvent(new PopStateEvent("popstate"));
	}, [presentationMode]);
	const [app, setApp] = useState<AppInstance | null>(null);
	const appRef = useRef<AppInstance | null>(null);
	appRef.current = app;
	const [error, setError] = useState<string | null>(null);
	const [wsStatus, setWsStatus] = useState<WsConnectionStatus | null>(null);
	const [boardName, setBoardName] = useState<string | null>(null);
	const wsProviderRef = useRef<WsProviderHandle | null>(null);

	// ボード単位で生きているもの（ルート doc・接続・ページ doc の管理役）と、ページの一覧。
	const [board, setBoard] = useState<BoardRuntime | null>(null);
	const lastOpenRef = useRef<{ pageId: string | null; ms: number } | null>(null);
	const activePageIdRef = useRef<string | null>(null);
	const switchPageRef = useRef<(pageId: string) => void>(() => {});
	const [pagesState, setPagesState] = useState<PagesState | null>(null);
	const pagesReady = pagesState !== null;
	const paged = pagesState?.paged ?? false;
	// 開くページ: URL の ?page= → 前回開いたページ → 先頭ページ。ページ無しのボードは null。
	const activePageId =
		boardId && pagesState?.paged
			? resolvePageId(pagesState.pages, {
					requested: readRequestedPage(location.search),
					lastOpened: readLastPage(boardId),
				})
			: null;
	// ページを切り替える（URL の ?page= を変える。ボードの接続はそのまま）。
	const switchPage = useCallback(
		(pageId: string) => {
			navigate({ pathname: location.pathname, search: pageSearch(location.search, pageId) });
		},
		[navigate, location.pathname, location.search],
	);
	activePageIdRef.current = activePageId;
	switchPageRef.current = switchPage;

	// プレゼン編集モードの stage 矩形 (Canvas を縮退させて配置する)。
	// app 生成 useEffect で presentation plugin に getViewportSize として渡すため、
	// ref でも保持する (stage 変更時に app を再生成しない)。
	const stageRectRef = useRef<StageRect | null>(
		presentationMode === "edit"
			? computePresentStage({ width: window.innerWidth, height: window.innerHeight })
			: null,
	);

	// ページ単位の初期化。開くページ（ページ無しのボードはルートの shapes）ごとに BoardStore と
	// App（プラグイン）を作り直す。React は cleanup を宣言順に走らせるので、ボード単位の effect
	// より前に宣言し、deps に boardId も入れて、ボードを閉じるときは接続より先に App を壊す。
	useEffect(() => {
		if (!boardId || !board || board.boardId !== boardId || !pagesReady) return;
		const pageId = paged ? activePageId : null;
		if (paged && !pageId) return;

		let cancelled = false;
		let instance: AppInstance | null = null;
		const startedAt = performance.now();
		const store = createBoardStore();
		const { rootDoc, serverClock } = board;
		const pageHandle = pageId ? board.pageDocs.open(pageId) : null;
		// store が紐づく doc。ページを使うボードはページ doc、使わないボードはルート doc。
		const shapesDoc = pageHandle?.doc ?? rootDoc;
		let syncHandle: YjsSyncHandle | null = null;
		if (pageId) rememberLastPage(boardId, pageId);

		const extraPlugins: UsketchPlugin[] = [];
		// ページを使うボードでは HUD にページパネル（一覧・追加・切り替えなど）を出す。
		if (pageId) {
			extraPlugins.push(
				createPagesPlugin({
					rootDoc: board.rootDoc,
					pageId,
					switchPage: (id) => switchPageRef.current(id),
					openPageDoc: (id) => board.pageDocs.open(id),
				}),
			);
		}
		// プラグインには「同じページの人だけが見える」provider を渡す（ページ無しなら元のまま）。
		const scopedProvider =
			board.wsProvider && pageId ? createPageScopedProvider(board.wsProvider, pageId) : null;
		const wsProvider: WsProviderHandle | null = scopedProvider ?? board.wsProvider;
		let croupierPresence: ReturnType<typeof createAwarenessPresence> | null = null;
		// Divergence tracker — surfaces shapes that exist in the local Y.Doc
		// but the server hasn't acknowledged. Wired up only for cloud boards
		// because local boards never round-trip with a server.
		let divergenceHandle: DivergenceTrackerHandle | null = null;

		if (wsProvider) {
			const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

			extraPlugins.push(createLaserPlugin(wsProvider));
			extraPlugins.push(createSpotlightPlugin(wsProvider));
			// ページを使うボードでは、別のページの人も追える（追っている人がページを移ればついて行く）
			extraPlugins.push(
				createFollowMePlugin({
					wsProvider,
					pages:
						pageId && board.wsProvider
							? {
									awareness: board.wsProvider.awareness,
									currentPageId: pageId,
									switchPage: (id) => switchPageRef.current(id),
								}
							: undefined,
				}),
			);
			extraPlugins.push(
				createPresenceCursorPlugin({
					wsProvider,
					userId: "anonymous",
					userName: "Anonymous",
				}),
			);
			// Draws every other participant's live selection/edit/marquee (#960).
			extraPlugins.push(createPresenceActivityPlugin({ wsProvider }));
			extraPlugins.push(
				createPresenceEnhancedPlugin({
					wsProvider,
					boardId,
					apiUrl,
				}),
			);

			// サイドパネル + コメント
			extraPlugins.push(createSidePanelPlugin());

			const aiHeaders: Record<string, string> = {};
			if (import.meta.env.DEV) {
				const devUser = getDevUser();
				if (devUser) aiHeaders["X-User-Id"] = devUser.id;
			}

			// ページを使うボードでは、コメントにページを記録し、一覧から別のページへ移れる
			extraPlugins.push(
				createCommentsPlugin({
					boardId,
					apiUrl,
					extraHeaders: aiHeaders,
					pages: pageId
						? {
								currentPageId: pageId,
								legacyPageId: getLegacyPageId(rootDoc),
								pageName: (id) => getPage(rootDoc, id)?.name ?? null,
								switchPage: (id) => switchPageRef.current(id),
							}
						: undefined,
				}),
			);
			// ボード履歴（サーバーの自動・手動コミット）の一覧・差分・プレビュー・復元。
			// ページを使うボードでは、今開いているページの中身を見せる。
			extraPlugins.push(createHistoryPlugin({ boardId, apiUrl, extraHeaders: aiHeaders, pageId }));

			// AI プラグイン
			// ページを使うボードでは、AI の配置・更新を今開いているページに書く。
			extraPlugins.push(createAiAgentPlugin({ apiUrl, extraHeaders: aiHeaders, pageId }));
			// ai-chat 内蔵の Cmd+K パレットは無効化（アクション操作は Control HUD の
			// Controls／検索に一本化済み）。
			extraPlugins.push(createAiChatPlugin({ boardId, enableCommandPalette: false }));
			extraPlugins.push(createAiActionsPlugin({ boardId }));
			extraPlugins.push(createAiCopilotPlugin({ apiUrl, boardId, extraHeaders: aiHeaders }));
			extraPlugins.push(createAiImagePlugin({ boardId }));
			extraPlugins.push(createAiRecognizePlugin({ boardId }));
			// Voice Notes: 録音→AI要約→まとめ Frame（生transcript は frame.meta）。
			// 文字起こしはサーバ Whisper 経由（ブラウザ Web Speech は network 制約で
			// 使えない環境が多いため）。Google 非経由でマイク点滅も無し。
			extraPlugins.push(
				createVoiceNotesPlugin({
					apiUrl,
					boardId,
					extraHeaders: aiHeaders,
					createTranscriber: () =>
						createWhisperTranscriber({ apiUrl, boardId, extraHeaders: aiHeaders, lang: "ja" }),
				}),
			);

			// OpenUI Generative UI. Routes LLM calls through the server's
			// `/api/ai/openui` proxy so the OpenAI API key never reaches the
			// browser bundle.
			const openuiModel = import.meta.env.VITE_OPENUI_MODEL;
			const openuiProvider = createServerProxyProvider({
				apiUrl,
				extraHeaders: aiHeaders,
				boardId,
				defaultModel: openuiModel,
			});
			extraPlugins.push(createOpenUIShapePlugin());
			extraPlugins.push(createOpenUIToolPlugin({ provider: openuiProvider }));

			extraPlugins.push(createWhistlePlugin(wsProvider));
			extraPlugins.push(createActivityFeedPlugin({ wsProvider, boardId, apiUrl }));

			// Live interactive sessions (voting first) — server-authoritative via the
			// MSG_SESSION channel. userId MUST match the WS connection identity so the
			// panel can tell whether this client is the host. The WS uses the dev user
			// in DEV (via `?devUserId=`) and the cookie-auth user in prod, so mirror
			// that precedence here — preferring authUser first would break host
			// detection (no "締める"/"終了") whenever the two identities differ.
			extraPlugins.push(
				createSessionPlugin({
					wsProvider,
					boardId,
					userId:
						(import.meta.env.DEV ? getDevUser()?.id : undefined) ??
						userIdRef.current ??
						"anonymous",
					types: [votingClientType],
				}),
			);
		} else {
			extraPlugins.push(createLaserPlugin());
			extraPlugins.push(createSpotlightPlugin());
			extraPlugins.push(createWhistlePlugin());
		}

		// 操作キャラ（WASD）: ローカル/Cloud 共通。Cloud では awareness で他ユーザーの
		// キャラと共存する。見た目はプラグインに持たせず、ホストの renderer を注入。
		{
			const seed = userIdRef.current ?? getDevUser()?.id ?? "local";
			extraPlugins.push(
				createCharacterPlugin({
					wsProvider: wsProvider ?? undefined,
					userName: userNameRef.current ?? getDevUser()?.name,
					appearance: characterAppearance(seed),
					renderCharacter,
					renderShadow: renderCharacterShadow,
					// 標高の坂は 45° まで歩いて登れる（map の段は maxStep のまま）。
					motion: { maxSlope: 45 },
				}),
			);
		}

		// 共有タイマー（Timter）: ローカル/Cloud 共通。タイマーは `timer` シェイプとして
		// 通常のシェイプ同期に乗り、時刻は serverClock 基準で全ユーザー一致。
		extraPlugins.push(
			createTimterPlugin({
				serverClock,
				userId: userIdRef.current ?? getDevUser()?.id ?? "local",
			}),
		);

		// ゲームテーブル（croupier）: croupier のゲームをシェイプとして遊ぶ。進行状態は
		// テーブルシェイプ、参加者は座席シェイプとして通常のシェイプ同期に乗る。
		// 1 シェイプ = 1 値の同期なので、手番制のゲームだけを載せる（同時に動くゲームは不可）。
		// ログインはボードの後に届くことがあるので、ユーザーは毎回 ref から読む
		// （作成時の値で固定すると、GitHub ログインの人が全員 "local" になる）。
		const croupierUserId = () => userIdRef.current ?? getDevUser()?.id ?? "local";
		// Cloud では awareness から接続中の人を知り、抜けた人の手番をホストが代行する。
		croupierPresence = wsProvider
			? createAwarenessPresence(wsProvider.awareness, croupierUserId)
			: null;
		extraPlugins.push(
			createCroupierPlugin({
				presence: croupierPresence ?? undefined,
				// 進行中のゲームはテーブルの meta ではなく doc の別マップに置く（テーブルを
				// ドラッグするたびに snapshot ごと履歴に積まれないように）。
				gameState: createMapGameState(rootDoc.getMap("croupier")),
				player: () => ({
					userId: croupierUserId(),
					name: userNameRef.current ?? getDevUser()?.name ?? "Guest",
				}),
				games: [
					defineCroupierGame({
						id: "values-card",
						label: "Values Card",
						createConfig: (options) =>
							createValuesCardConfig({
								theme: typeof options.theme === "string" ? options.theme : undefined,
							}),
						// 既定の見た目でカードを選んで捨てる / 拾うためのボタン。
						actionChoices: (action, gameView, viewer) => {
							const view = gameView as ValuesCardState | null;
							if (!view) return [];
							if (action === "discardCard") {
								return (view.players[viewer]?.hand ?? []).map((card) => ({
									label: `捨てる: ${card.name}`,
									payload: { cardId: card.id },
								}));
							}
							if (action === "drawFromDiscard") {
								return view.discardPool.map(({ card }) => ({
									label: `拾う: ${card.name}`,
									payload: { cardId: card.id },
								}));
							}
							return [{ label: action === "drawFromDeck" ? "山札から引く" : action }];
						},
					}),
				],
				now: () => serverClock.now(),
			}),
		);

		// Portal: 任意のシェイプを画面固定でピン。既定は個人（localStorage）、共有トグルで
		// doc の `portals` マップに載せて全員へ。ローカル/Cloud 共通。
		extraPlugins.push(
			createPortalPlugin({
				doc: rootDoc,
				boardId,
				userId: userIdRef.current ?? getDevUser()?.id ?? "local",
				// ページを使うボードでは、今のページで作ったポータルだけを出す
				pageId: pageId ?? undefined,
				legacyPageId: pageId ? getLegacyPageId(rootDoc) : null,
			}),
		);

		// Asset store: content-addressed な asset を doc の `assets` マップで共有。
		// 画像等の重い blob を一度だけ保持し shape は assetId 参照（複製で再利用）。
		extraPlugins.push(createAssetStorePlugin({ doc: rootDoc }));

		// Embed: 外部Web を iframe 埋め込み（`embed` シェイプ）。YouTube は再生位置を
		// 全ユーザーで同期（server clock 基準）。URL 貼り付け/ドロップでも生成。
		extraPlugins.push(
			createEmbedShapePlugin({
				// Reuse the board-level clock (shared with Timter) instead of a 2nd poller.
				serverClock,
				boardId,
				userId: userIdRef.current ?? getDevUser()?.id ?? "local",
			}),
		);

		// プレゼンテーション: ローカル/Cloud 共通で常にロードし、`?present=1` が付いた時だけ UI を出す。
		// ルート切替せず URL クエリで切替える設計なので、アプリ再生成は起きない。
		extraPlugins.push(
			createPresentationPlugin({
				getMode: () => modeRef.current,
				navigateToBoard: () => {
					if (boardId) {
						navigate(isCloudBoard ? `/boards/${boardId}` : `/local/${boardId}`);
					}
				},
				getViewportSize: () => {
					const stage = stageRectRef.current;
					if (stage) return { width: stage.width, height: stage.height };
					return { width: window.innerWidth, height: window.innerHeight };
				},
				// マルチページ: 最後のスライドの次で次のページへ、最初の前で前のページの最後へ。
				// ページを切り替えても ?present / ?mode は残るので、発表のまま次のページが開く。
				pages: pageId
					? {
							hasPage: (step) => neighborPage(rootDoc, pageId, step) !== null,
							goToPage: (step) => {
								const target = neighborPage(rootDoc, pageId, step);
								if (target) switchPageRef.current(target.id);
							},
							pageLabel: () => {
								const pages = listPages(rootDoc);
								const index = pages.findIndex((p) => p.id === pageId);
								if (pages.length < 2 || index < 0) return null;
								return `${pages[index]?.name}（${index + 1}/${pages.length}）`;
							},
						}
					: undefined,
			}),
		);

		// スタート位置: ボードの初期視点（座標/画角/Shape）へ起動時に移動。deep-link より
		// 前に登録して viewport:claimed を購読させ、URL ディープリンクがあればそちらに譲る。
		extraPlugins.push(createStartPositionPlugin());

		// Deep link: URL ⇄ 選択/視点の同期（Figma の ?node-id 相当）。最後に登録し、
		// setup が whenSynced 後に走ることで、サーバ視点復元より後に URL アンカーを適用する。
		extraPlugins.push(createDeepLinkPlugin());

		(pageHandle?.whenLoaded ?? Promise.resolve())
			.then(() => {
				if (cancelled) return;

				// Cloud boards: the divergence-aware tracker replaces the IDB-only status
				// (which can't see server divergence). Created before the store is filled
				// so every restored shape starts as "local" until the server confirms it.
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
				const handle = createYjsSync(store, { doc: shapesDoc, persist: false });
				syncHandle = handle;
				syncStatusStore.setTracker(divergenceHandle?.status ?? handle.status);

				// マルチページ: 「全ページ」の書き出しは、開いていないページの doc も読んで並べる。
				const exportOptions: ExportPluginOptions | undefined = pageId
					? {
							pages: {
								list: () => listPages(rootDoc).map((p) => ({ id: p.id, name: p.name })),
								loadShapes: async (id) => {
									const handle = board.pageDocs.open(id);
									try {
										await handle.whenLoaded;
										return new Map(handle.doc.getMap<ShapeData>(PAGE_SHAPES_MAP_KEY).entries());
									} finally {
										handle.release();
									}
								},
							},
						}
					: undefined;
				return loadPlugins(
					extraPlugins,
					{
						userId: userIdRef.current ?? getDevUser()?.id ?? "local",
						boardId,
						wsProvider,
					},
					exportOptions,
				)
					.then((plugins) =>
						createApp({ store, plugins, keymap: { warnConflicts: import.meta.env.DEV } }),
					)
					.then((created) => {
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

						// Surface shapes that diverge from the server's Y.Doc.
						// Cloud boards only — local boards have no server to diverge from.
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

						// 「デスクトップを追加」で開いたボードは window-system を既定で有効化。
						// whenSynced 後なので既存 config は複製されない（enable は冪等）。
						if (desktopTemplateRef.current) {
							getWindowSystemApi(a.services)?.enable();
						}

						setApp(instance);
						// ページの切替時間（App の作り直しまで含む）。重いプラグインで遅くなって
						// いないかを見るため、開発中はコンソールに出す。
						const openedMs = Math.round(performance.now() - startedAt);
						lastOpenRef.current = { pageId, ms: openedMs };
						if (import.meta.env.DEV && pageId) {
							console.info(`[pages] opened ${pageId} in ${openedMs}ms`);
						}
					});
			})
			.catch((e) => {
				if (!cancelled) {
					setError(getErrorMessage(e, "Failed to initialize board"));
				}
			});

		return () => {
			cancelled = true;
			instance?.destroy();
			croupierPresence?.dispose();
			scopedProvider?.dispose();
			divergenceHandle?.destroy();
			syncHandle?.destroy();
			pageHandle?.release();
			syncStatusStore.setTracker(null);
			setApp(null);
		};
		// NOTE: presentationMode は依存に入れない。?present の切替では app を再作成せず、
		// presentation plugin が modeRef 経由で最新値を読む（undo 履歴・WebSocket を残すため）。
	}, [boardId, isCloudBoard, navigate, board, pagesReady, paged, activePageId]);

	// ボード単位の初期化（boardId / isCloudBoard に依存）。ルート doc・IndexedDB・WebSocket・
	// サーバー時計・Members 用の awareness はボードを開いている間ずっと生かし、ページを
	// 切り替えても作り直さない。ページ doc は pageDocs が開いたページの分だけ読む。
	useEffect(() => {
		if (!boardId) return;

		let cancelled = false;
		const rootDoc = new Y.Doc();
		const rootPersistence = persistDocToIndexedDb(`usketch-board-${boardId}`, rootDoc);

		// Shared server clock so collaborative timers agree on "now" regardless of
		// device clock skew. Cloud boards measure the offset against the server;
		// local boards use the local clock (offset 0).
		const serverClock = createServerClock({
			baseUrl: isCloudBoard ? (import.meta.env.VITE_API_URL ?? "http://localhost:8787") : null,
		});

		let wsProvider: WsProviderHandle | null = null;
		let offPresence: (() => void) | null = null;

		if (isCloudBoard) {
			const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
			let wsUrl = `${apiUrl.replace(/^http/, "ws")}/api/boards/${boardId}/ws`;
			// DEV_MODE: WebSocketはカスタムヘッダーを送れないのでクエリパラメータで認証
			if (import.meta.env.DEV) {
				const devUser = getDevUser();
				if (devUser) {
					wsUrl += `?devUserId=${encodeURIComponent(devUser.id)}`;
				}
			}
			wsProvider = createWsProvider({ url: wsUrl, doc: rootDoc });
			wsProviderRef.current = wsProvider;
			wsProvider.onStatusChange(setWsStatus);

			// オンラインメンバーを Control HUD (Members パネル) へ供給。
			// TopBar の PresencePill を置き換え。ページに関係なくボードの全員を出す。
			const awarenessForPresence = wsProvider.awareness;
			// ページを使うボードでは、各人のページ名と「別のページにいるか」も添える。
			const pageName = (id: string) =>
				isPagedBoard(rootDoc) ? (getPage(rootDoc, id)?.name ?? null) : null;
			const updatePresence = () =>
				presenceStore.set(readPresenceMembers(awarenessForPresence, pageName));
			awarenessForPresence.on("change", updatePresence);
			const offPageNames = observePages(rootDoc, updatePresence);
			presenceStore.openPage = (id) => switchPageRef.current(id);
			updatePresence();
			offPresence = () => {
				awarenessForPresence.off("change", updatePresence);
				offPageNames();
				presenceStore.openPage = null;
			};
		}

		const pageDocs = createPageDocManager({
			provider: wsProvider,
			persist: (pageId, doc) => persistDocToIndexedDb(pageDocName(boardId, pageId), doc),
		});

		// ページ一覧と「ページを使うボードか」はルート doc から読む。サーバーから版が届いて
		// ページを使うボードだと分かった時点で、ページ単位の effect が開き直す。
		const readPages = () =>
			setPagesState({ paged: isPagedBoard(rootDoc), pages: listPages(rootDoc) });
		const offPages = observePages(rootDoc, readPages);

		rootPersistence.whenSynced.then(async () => {
			if (cancelled) return;
			// ローカルボードの移行はクライアントで行う（クラウドボードはサーバーが行う）
			if (!isCloudBoard) {
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
			wsProviderRef.current = null;
			serverClock.destroy();
			rootPersistence.destroy();
			rootDoc.destroy();
			setBoard(null);
			setPagesState(null);
		};
	}, [boardId, isCloudBoard]);

	// 開発用: ページの UI（pages プラグイン）が入るまで、コンソールからページを作って
	// 切り替えられるようにする。`__usketchPages.init()` でまだ空のボードをページ形式にする。
	useEffect(() => {
		if (!import.meta.env.DEV || !board) return;
		const w = window as unknown as { __usketchPages?: unknown };
		w.__usketchPages = {
			list: () => listPages(board.rootDoc),
			current: () => activePageIdRef.current,
			init: (name = "ページ 1") => initPagedBoard(board.rootDoc, { name }),
			create: (name: string) => createPage(board.rootDoc, { name }),
			switchTo: (pageId: string) => switchPageRef.current(pageId),
			loaded: () => board.pageDocs.loadedPageIds(),
			// 最後に開き終えたページと、そこまでの時間（ms）
			lastOpen: () => lastOpenRef.current,
			store: () => appRef.current?.store ?? null,
		};
		return () => {
			delete w.__usketchPages;
		};
	}, [board]);

	// Cloud ボードのタイトル取得（Control HUD の Board メタ表示用）
	useEffect(() => {
		if (!boardId) {
			setBoardName(null);
			return;
		}
		if (!isCloudBoard) {
			const local = localBoards.list().find((b) => b.id === boardId);
			setBoardName(local?.title ?? null);
			return;
		}
		let cancelled = false;
		const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
		const headers: Record<string, string> = {};
		if (import.meta.env.DEV) {
			const devUser = getDevUser();
			if (devUser) headers["X-User-Id"] = devUser.id;
		}
		fetch(`${apiUrl}/api/boards/${boardId}`, { credentials: "include", headers })
			.then((r) => (r.ok ? r.json() : null))
			.then((b) => {
				if (cancelled) return;
				const t = b as { title?: unknown; name?: unknown } | null;
				const name =
					typeof t?.title === "string" ? t.title : typeof t?.name === "string" ? t.name : null;
				setBoardName(name);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [boardId, isCloudBoard]);

	// Board メタ情報を Control HUD 用ストアへ反映（表示は HUD の General パネル）。
	useEffect(() => {
		boardMetaStore.set({ id: boardId, name: boardName, isCloud: isCloudBoard });
	}, [boardId, boardName, isCloudBoard]);

	// ページ離脱時にビューポート位置を保存（ゴーストアバター用）
	useEffect(() => {
		if (!isCloudBoard || !boardId) return;

		const saveViewport = () => {
			const ws = wsProviderRef.current;
			if (!ws) return;
			const local = ws.awareness.getLocalState();
			const vc = local?.viewportCenter as { x: number; y: number } | undefined;
			if (!vc) return;
			const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
			const headers: Record<string, string> = { "Content-Type": "application/json" };
			if (import.meta.env.DEV) {
				const devUser = getDevUser();
				if (devUser) headers["X-User-Id"] = devUser.id;
			}
			fetch(`${apiUrl}/api/boards/${boardId}/viewport`, {
				method: "PATCH",
				headers,
				body: JSON.stringify(vc),
				credentials: "include",
				keepalive: true,
			}).catch(() => {});
		};

		window.addEventListener("beforeunload", saveViewport);
		return () => window.removeEventListener("beforeunload", saveViewport);
	}, [boardId, isCloudBoard]);

	// セッション情報が確定したらAwarenessのローカル状態を更新
	const authUserId = authUser?.id;
	const authUserName = authUser?.name;
	useEffect(() => {
		const wsProvider = wsProviderRef.current;
		if (!wsProvider || !authUserId) return;

		wsProvider.awareness.setLocalStateField("user", {
			name: authUserName ?? "Anonymous",
		});
	}, [authUserId, authUserName]);

	// キーボードショートカット。Vim-first でも有効のまま（vim プラグインが capture
	// フェーズでキーを先取りするため衝突せず、Vim 非アクティブ時は通常通り動く）。
	useKeyboardShortcuts(app, presentationMode === "present");

	// 共有ダイアログは App が所有し、Control HUD の「共有」アクションから開く。
	const [showShare, setShowShare] = useState(false);
	const openShare = useCallback(() => setShowShare(true), []);

	// アプリ横断の操作を共有アクションレジストリへ登録。Control HUD の Controls／
	// 検索が単一ソースとして参照する。
	useAppActions(app, boardId, isCloudBoard, openShare);

	// Vim モードは既定 OFF（store の既定ツールは "select"）。Control HUD の
	// "Vim mode" アクションで実行時に切り替える。プレゼン発表へ切替時のみ、vim が
	// 残り続けないよう select に戻す。
	useEffect(() => {
		if (!app) return;
		if (presentationMode === "present") {
			app.store.setDefaultToolId("select");
			app.store.setActiveToolId("select");
		}
	}, [app, presentationMode]);

	// Info タブを SidePanel に登録（Cloud ボードのみ）
	useEffect(() => {
		if (!app || !isCloudBoard || !boardId) return;
		const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
		app.events.emit("side-panel:register-tab", {
			tab: {
				id: "info",
				label: "情報",
				icon: "📋",
				iconComponent: () => (
					<svg
						width={13}
						height={13}
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="M2 4a1 1 0 0 1 1-1h3l1.5 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4Z" />
					</svg>
				),
				order: 30,
				render: () => <InfoTab boardId={boardId} apiUrl={apiUrl} />,
			},
		});
		return () => {
			app.events.emit("side-panel:unregister-tab", { tabId: "info" });
		};
	}, [app, boardId, isCloudBoard]);

	const [stageRect, setStageRect] = useState<StageRect | null>(stageRectRef.current);
	stageRectRef.current = stageRect;
	useEffect(() => {
		if (presentationMode !== "edit") {
			setStageRect(null);
			return;
		}
		const update = () =>
			setStageRect(computePresentStage({ width: window.innerWidth, height: window.innerHeight }));
		update();
		window.addEventListener("resize", update);
		return () => window.removeEventListener("resize", update);
	}, [presentationMode]);

	if (error) {
		return (
			<div style={{ padding: "24px", fontFamily: "system-ui, sans-serif", color: "#c33" }}>
				<p>Error: {error}</p>
				<a href="/">Back to Dashboard</a>
			</div>
		);
	}

	if (!app) {
		// ページを切り替えている間（ページ doc の読み込みと App の作り直し）だけ表示する。
		if (!pagesState?.paged) return null;
		return (
			<div
				style={{
					position: "fixed",
					inset: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: "var(--bg-canvas-2, #0a0a0b)",
					color: "var(--text-muted, #9aa0aa)",
					fontSize: 13,
				}}
			>
				ページを読み込み中…
			</div>
		);
	}

	// 発表モード中、または Vim-first UI では通常の chrome を隠す
	// ツールバーは通常表示。Vim モードは既定 OFF で、Control HUD の "Vim mode"
	// アクションから切り替える（プレゼン発表中のみ chrome を隠す）。
	const hideToolbar = presentationMode === "present";
	// プレゼン編集モード中はスライド編集に関係ない UI を隠す
	const isPresentEdit = presentationMode === "edit";
	// 発表中は Canvas を readonly (シェイプ選択/ドラッグ/描画を全てオフ)
	const isPresenting = presentationMode === "present";

	return (
		<AppProvider app={app}>
			<div
				style={{
					width: "100%",
					height: "100%",
					overflow: "hidden",
					position: "relative",
					background: "var(--bg-canvas-2, #0a0a0b)",
				}}
			>
				{/*
					エディタ全体 (Canvas + 各種オーバーレイ) をひとつの div で包む。
					プレゼン編集モード中は stage 矩形に縮め、外側を発表 UI が取り囲む形にする。
					transform を当てると内側の position: fixed 要素の containing block が
					この div になるため、HUD 等を書き換えずに相対化できる (CSS spec)。
				*/}
				<div
					style={
						stageRect
							? {
									position: "absolute",
									left: stageRect.left,
									top: stageRect.top,
									width: stageRect.width,
									height: stageRect.height,
									borderRadius: 8,
									overflow: "hidden",
									transform: "translate(0, 0)",
									boxShadow: "0 30px 60px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06)",
									transition:
										"left 180ms var(--ease-out, ease-out), top 180ms var(--ease-out, ease-out), width 180ms var(--ease-out, ease-out), height 180ms var(--ease-out, ease-out)",
								}
							: {
									position: "absolute",
									inset: 0,
								}
					}
				>
					<Canvas />
					{/* TopBar は撤去: ロゴ(→dashboard)/テーマ/プレゼン/コミュニティは全て
					    Control HUD の action(nav:dashboard / theme:* / edit:present /
					    nav:community)に一本化済み。HUD は `` ` `` で開く（bottom-center に
					    常時ヒントあり）。 */}
					{!hideToolbar && isCloudBoard && !isPresentEdit && <CopilotPill />}
				</div>
				{/* 閉じタグ: エディタ全体ラッパーの終わり */}
				{showShare && boardId && (
					<ShareDialog boardId={boardId} onClose={() => setShowShare(false)} store={app?.store} />
				)}
				{isCloudBoard && wsStatus === "failed" && (
					<div
						className="u-surface"
						style={{
							position: "fixed",
							bottom: 60,
							left: "50%",
							transform: "translateX(-50%)",
							background: "var(--danger)",
							color: "white",
							padding: "8px 20px",
							borderRadius: 10,
							fontSize: 13,
							zIndex: 200,
						}}
					>
						接続できません — このボードへのアクセス権限がない可能性があります
					</div>
				)}
				{isCloudBoard && wsStatus === "connecting" && (
					<div
						className="u-surface"
						style={{
							position: "fixed",
							bottom: 60,
							left: "50%",
							transform: "translateX(-50%)",
							background: "var(--warning)",
							color: "white",
							padding: "8px 20px",
							borderRadius: 10,
							fontSize: 13,
							zIndex: 200,
						}}
					>
						接続中…
					</div>
				)}
			</div>
			{isPresenting &&
				createPortal(
					<div
						aria-hidden="true"
						style={{
							position: "fixed",
							inset: 0,
							zIndex: 300,
							cursor: "default",
							background: "transparent",
						}}
						onPointerDown={(e) => {
							e.stopPropagation();
							e.preventDefault();
						}}
						onPointerMove={(e) => e.stopPropagation()}
						onPointerUp={(e) => e.stopPropagation()}
						onWheel={(e) => e.stopPropagation()}
						onContextMenu={(e) => {
							e.stopPropagation();
							e.preventDefault();
						}}
					/>,
					document.body,
				)}
		</AppProvider>
	);
}
