import { createValuesCardConfig, type ValuesCardState } from "@edv4h/croupier-plugin-values-card";
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
import { createRippleEffectPlugin } from "@edv4h/usketch-plugin-effect-ripple";
import { createElevationPlugin } from "@edv4h/usketch-plugin-elevation";
import { createExportPlugin } from "@edv4h/usketch-plugin-export";
import { createFollowMePlugin } from "@edv4h/usketch-plugin-follow-me";
import { createFreePositionPlugin } from "@edv4h/usketch-plugin-free-position";
import { createHistoryPlugin } from "@edv4h/usketch-plugin-history";
import { createKeySettingsPlugin } from "@edv4h/usketch-plugin-key-settings";
import { createKeyboardShortcutsPlugin } from "@edv4h/usketch-plugin-keyboard-shortcuts";
import { createLaserPlugin } from "@edv4h/usketch-plugin-laser";
import { createMapPlugin } from "@edv4h/usketch-plugin-map";
import { createMarkdownToShapePlugin } from "@edv4h/usketch-plugin-markdown-to-shape";
import { createMode7Plugin } from "@edv4h/usketch-plugin-mode7";
import { createPagesPlugin } from "@edv4h/usketch-plugin-pages";
import { createPdfImportPlugin } from "@edv4h/usketch-plugin-pdf-import";
import { createPortalPlugin } from "@edv4h/usketch-plugin-portal";
import { createPresenceActivityPlugin } from "@edv4h/usketch-plugin-presence-activity";
import { createPresenceCursorPlugin } from "@edv4h/usketch-plugin-presence-cursor";
import { createPresenceEnhancedPlugin } from "@edv4h/usketch-plugin-presence-enhanced";
import { createPresentationPlugin } from "@edv4h/usketch-plugin-presentation";
import { createReactionsPlugin } from "@edv4h/usketch-plugin-reactions";
import { createScatterPlugin } from "@edv4h/usketch-plugin-scatter";
import { createSessionPlugin } from "@edv4h/usketch-plugin-session";
import { createShape3dPlugin } from "@edv4h/usketch-plugin-shape-3d";
import { createBasicShapePlugin } from "@edv4h/usketch-plugin-shape-basic";
import {
	type BoardPortalShapeData,
	createBoardPortalPlugin,
} from "@edv4h/usketch-plugin-shape-board-portal";
import {
	cardTurnFace,
	createCardPlugin,
	EXAMPLE_CARD_TYPES,
} from "@edv4h/usketch-plugin-shape-card";
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
import { createSpatialChatPlugin } from "@edv4h/usketch-plugin-spatial-chat";
import { createSpotlightPlugin } from "@edv4h/usketch-plugin-spotlight";
import { createStartPositionPlugin } from "@edv4h/usketch-plugin-start-position";
import { createTabletopPlugin } from "@edv4h/usketch-plugin-tabletop";
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
import { createVotingPlugin } from "@edv4h/usketch-plugin-voting";
import { createWhistlePlugin } from "@edv4h/usketch-plugin-whistle";
import { createWindowSystemPlugin } from "@edv4h/usketch-plugin-window-system";
import { votingClientType } from "@edv4h/usketch-session-voting/client";
import type { ShapeData, UsketchPlugin } from "@edv4h/usketch-shared";
import {
	getLegacyPageId,
	getPage,
	listPages,
	PAGE_SHAPES_MAP_KEY,
	type PageMeta,
} from "@edv4h/usketch-sync";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { api } from "../lib/api.js";
import {
	characterAppearance,
	renderCharacter,
	renderCharacterShadow,
} from "../lib/character-renderer.js";
import { getDevUser } from "../lib/dev-auth.js";
import { loadViewportCull, loadViewportLod } from "../lib/render-settings.js";
import { stockTerritoryStyle } from "../pages/community/map-territory-style.js";
import { createBoardMetaPanelPlugin } from "../plugins/board-meta-panel.js";
import { createMarkdownAdaptersPlugin } from "../plugins/markdown-adapters.js";
import { createPresencePanelPlugin } from "../plugins/presence-panel.js";
import { createSyncStatusPanelPlugin } from "../plugins/sync-status-panel.js";
import { createViewportLodControlPlugin } from "../plugins/viewport-lod-control.js";
import { type HostWiring, localUserId, localUserName } from "./host-wiring.js";
import { PAGE_PRESETS, PRESET_IDS, pagePlugins } from "./page-presets.js";

type Created = UsketchPlugin | UsketchPlugin[] | null;

/** カタログの 1 項目。ページに入れるかどうかを選べる単位（1 つで複数のプラグインを作ることもある）。 */
export interface CatalogEntry {
	/** 選ぶときの id（たいてい npm 名の末尾）。 */
	id: string;
	label: string;
	/** どのページにも入る（外せない）。 */
	base?: boolean;
	/** サーバーとの接続が要る。接続の無いボード（お試しボード・未ログイン）では読まない。 */
	needsServer?: boolean;
	/** 同じページに入れられないもの（HUD で入れると外れる）。 */
	conflicts?: readonly string[];
	/** 配線を受けてプラグインを作る。null ならこのホストでは読まない。 */
	create(w: HostWiring): Created | Promise<Created>;
}

/** `?renderer3d=gpu` なら WebGL2 の GPU レンダラー（実験中）。既定は CSS 3D。 */
export function readRenderer3d(search: string): "css" | "gpu" {
	return new URLSearchParams(search).get("renderer3d") === "gpu" ? "gpu" : "css";
}

const currentSearch = () => (typeof window !== "undefined" ? window.location.search : "");

/**
 * デモで使えるプラグインの一覧。**並び順が登録順**で、順番の決まりはここ 1 か所に持つ
 * （container の後に tabletop / dashboard / window-system、side-panel はタブを足す側より前、
 * start-position → deep-link は最後のほう、HUD は最後）。ページに入れるものはプリセット
 * （`page-presets.ts`）で選ぶ。
 */
/** ホストの見え方（権限で隠す・本当の名前）を当てたページ一覧。 */
function visiblePages(w: HostWiring): PageMeta[] {
	const view = w.host.pageView;
	const pages = listPages(w.board.rootDoc);
	if (!view) return pages;
	return pages
		.filter((p) => p.id === w.pageId || !view.isVisible || view.isVisible(p.id))
		.map((p) => {
			const name = view.displayName?.(p);
			return name === undefined ? p : { ...p, name };
		});
}

/** 見えるページの中で、`pageId` の次・前。 */
function visibleNeighbor(w: HostWiring, pageId: string, step: 1 | -1): PageMeta | null {
	const pages = visiblePages(w);
	const index = pages.findIndex((p) => p.id === pageId);
	return index < 0 ? null : (pages[index + step] ?? null);
}

export const PLUGIN_CATALOG: readonly CatalogEntry[] = [
	{ id: "bg-grid", label: "方眼の背景", base: true, create: () => createGridBgPlugin() },
	{ id: "bg-dots", label: "点の背景", base: true, create: () => createDotsBgPlugin() },
	{ id: "tool-select", label: "選択", base: true, create: () => createSelectToolPlugin() },
	{ id: "tool-pan", label: "手のひら", base: true, create: () => createPanToolPlugin() },
	{
		id: "tool-vim",
		label: "Vim",
		create: () =>
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
	},
	{ id: "viewport-nav", label: "視点の移動", base: true, create: () => createViewportNavPlugin() },
	{ id: "edge-pan", label: "端で画角スライド", create: () => createEdgePanPlugin() },
	{ id: "shape-basic", label: "基本シェイプ", create: () => createBasicShapePlugin() },
	{ id: "shape-group", label: "グループ", create: () => createGroupPlugin() },
	{
		id: "shape-board-portal",
		label: "ボードへのゲート",
		create: (w) =>
			createBoardPortalPlugin({
				onPortalOpen: (portalBoardId) => w.host.navigate?.(`/boards/${portalBoardId}`),
				onPortalCreate: async (shapeId, _position, isPublic) => {
					try {
						const created = await api.boards.create("New Board");
						if (isPublic) await api.boards.update(created.id, { isPublic: true });
						const user = w.user();
						w.store.updateShape(shapeId, {
							boardId: created.id,
							boardTitle: created.title,
							ownerName: user.name ?? "",
							ownerImage: user.image ?? "",
							isPublic,
						} as Partial<BoardPortalShapeData>);
					} catch (e) {
						console.error("Failed to create board:", e);
						w.store.deleteShape(shapeId);
					}
				},
			}),
	},
	{ id: "shape-frame", label: "フレーム", create: () => createFramePlugin() },
	{
		id: "shape-connector",
		label: "コネクタ",
		create: () => createConnectorPlugin({ freeEnds: true }),
	},
	{ id: "shape-freedraw", label: "フリーハンド", create: () => createFreedrawPlugin() },
	{ id: "shape-text", label: "テキスト", create: () => createTextPlugin() },
	{
		id: "shape-markdown",
		label: "Markdown",
		create: () => [
			createMarkdownPlugin(),
			createMarkdownToShapePlugin(),
			createMarkdownAdaptersPlugin(),
		],
	},
	{ id: "shape-sticky", label: "付箋", create: () => createStickyPlugin() },
	{
		id: "shape-card",
		label: "カード",
		create: (w) =>
			createCardPlugin({
				cardTypes: EXAMPLE_CARD_TYPES,
				userId: localUserId(w),
				boardId: w.boardId,
				wsProvider: w.wsProvider ?? undefined,
			}),
	},
	{ id: "shape-image", label: "画像", create: () => createImageShapePlugin() },
	// PDF のペースト／ドロップを pdf-page シェイプの集合に展開する。pdf.js のワーカーは
	// 実行コードなので CDN ではなく自前でバンドルして配信する。
	{
		id: "pdf-import",
		label: "PDF 取り込み",
		create: () => createPdfImportPlugin({ workerSrc: pdfWorkerUrl }),
	},
	{ id: "shape-counter", label: "カウンター", create: () => createCounterPlugin() },
	{ id: "shape-wireframe", label: "ワイヤーフレーム", create: () => createWireframePlugin() },
	{ id: "domain-design", label: "ドメイン設計", create: () => createDomainDesignPlugin() },
	{ id: "snap", label: "スナップ", create: () => createSnapPlugin() },
	{ id: "free-position", label: "自由配置", create: () => createFreePositionPlugin() },
	{
		id: "container",
		label: "入れ物",
		create: () => [createContainerPlugin(), createAttachablePlugin()],
	},
	// テーブルゲームの置き場。中身の吸着は container が行うので、その後に置く。
	// 「伏せて置く」置き場はカードを裏返す。
	{
		id: "tabletop",
		label: "テーブルゲームの置き場",
		create: () => createTabletopPlugin({ turnFace: cardTurnFace }),
	},
	// container/free-position の後に置き、ドラッグ中の並べ直しを最後の書き手にする。
	// ボードを勝手にグリッド化せず、HUD の「ダッシュボード化」で使い始める。
	{
		id: "dashboard",
		label: "ダッシュボード",
		create: () => createDashboardPlugin({ autoCreate: false }),
	},
	{
		id: "window-system",
		label: "ウィンドウシステム",
		create: () => createWindowSystemPlugin({ autoEnable: false }),
	},
	// 未設定のタイルは海として読むので、マップは陸を塗った無限の海になる。陣地の見た目は
	// デモ側（stockTerritoryStyle）が持つ。標高より前に置く。
	{
		id: "map",
		label: "マップ",
		create: () => createMapPlugin({ emptyTerrain: "water", territory: stockTerritoryStyle }),
	},
	// 標高（連続した高さの地形）。地面の高さを提供するので、キャラは坂を上り下りし、
	// 3D の Shape は丘に乗る。HUD「標高」で地形を作る。
	{
		id: "elevation",
		label: "標高",
		conflicts: ["map"],
		create: () => createElevationPlugin(),
	},
	// 3D 表示の描画（既定は CSS 3D）。Mode 7 などの 3D ビューはボードの 3D 表示の状態を
	// 変えるだけで、描くのはこのレンダラー。
	{
		id: "renderer-3d",
		label: "3D の描画",
		base: true,
		create: () =>
			readRenderer3d(currentSearch()) === "gpu"
				? createGpu3dRendererPlugin()
				: createCss3dRendererPlugin(),
	},
	// Mode 7（擬似3D地平面ビュー）。既定 OFF（HUD「3Dビュー切替」で切替）。
	{
		id: "mode7",
		label: "Mode 7（3D ビュー）",
		create: () => createMode7Plugin({ transition: { durationMs: 900 } }),
	},
	// 全プラグインのキーを 1 つの HUD「キー設定」で一覧・付け替え（閲覧者ごとに保存）。
	{ id: "key-settings", label: "キー設定", base: true, create: () => createKeySettingsPlugin() },
	// Mode 7 中に Shape を立てる。ボードへのゲートは指定しなくても立つ（ゲートとして見えるように）。
	{
		id: "shape-3d",
		label: "Shape 3D",
		create: () =>
			createShape3dPlugin({ types: { "board-portal": { default: { mode: "stand" } } } }),
	},
	// 関連 Shape を「ぶちまける」。connector/container/free-position の後。
	{ id: "scatter", label: "ぶちまける", create: () => createScatterPlugin() },
	{
		id: "export",
		label: "書き出し",
		create: (w) => {
			const { pageId, board } = w;
			if (!pageId) return createExportPlugin();
			// 「全ページ」の書き出しは、開いていないページの doc も読んで並べる。
			return createExportPlugin({
				pages: {
					list: () => visiblePages(w).map((p) => ({ id: p.id, name: p.name })),
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
			});
		},
	},
	{ id: "gpu-renderer", label: "GPU の描画", create: () => createGpuRendererPlugin() },
	{
		id: "dom-renderer",
		label: "DOM の描画",
		base: true,
		create: () =>
			createDomRendererPlugin({
				// 保存した設定から始める。変更は Control HUD から来る。
				viewportLod: (() => {
					const s = loadViewportLod();
					return s.enabled ? { ratio: s.ratio } : false;
				})(),
				viewportCull: (() => {
					const s = loadViewportCull();
					return s.enabled ? { ratio: s.ratio } : false;
				})(),
			}),
	},
	{
		id: "viewport-lod-control",
		label: "描画の間引き",
		base: true,
		create: () => createViewportLodControlPlugin(),
	},
	{
		id: "board-meta-panel",
		label: "ボード情報",
		base: true,
		create: () => createBoardMetaPanelPlugin(),
	},
	{
		id: "presence-panel",
		label: "オンライン",
		base: true,
		create: () => createPresencePanelPlugin(),
	},
	{
		id: "sync-status-panel",
		label: "保存と接続",
		base: true,
		create: () => createSyncStatusPanelPlugin(),
	},
	// ページパネル。ページごとのプラグイン（プリセットから作る・1 つずつ足し引き）も選べる。
	{
		id: "pages",
		label: "ページ",
		base: true,
		create: (w) => {
			if (!w.pageId || !w.host.pagesPanel) return null;
			const fallback = w.host.defaultPreset ?? "whiteboard";
			const connected = w.wsProvider !== null;
			return createPagesPlugin({
				rootDoc: w.board.rootDoc,
				pageId: w.pageId,
				switchPage: w.switchPage,
				openPageDoc: (id) => w.board.pageDocs.open(id),
				// 権限で見られないページを隠し、伏せた名前の代わりに本当の名前を出す
				pageView: w.host.pageView,
				pagePlugins: {
					presets: PRESET_IDS.map((id) => ({ id, label: PAGE_PRESETS[id].label })),
					defaultPreset: fallback,
					// 外せないもの・この接続では読めないものは選べない
					choices: PLUGIN_CATALOG.filter((e) => !e.base && (connected || !e.needsServer)).map(
						(e) => ({ id: e.id, label: e.label, conflicts: e.conflicts }),
					),
					resolve: (page) => pagePlugins(page, fallback),
				},
			});
		},
	},
	{
		id: "laser",
		label: "レーザーポインター",
		create: (w) => createLaserPlugin(w.wsProvider ?? undefined),
	},
	{
		id: "spotlight",
		label: "スポットライト",
		create: (w) => createSpotlightPlugin(w.wsProvider ?? undefined),
	},
	// ページを使うボードでは、別のページの人も追える（追っている人がページを移ればついて行く）。
	{
		id: "follow-me",
		label: "追従",
		needsServer: true,
		create: (w) =>
			w.wsProvider
				? createFollowMePlugin({
						wsProvider: w.wsProvider,
						pages:
							w.pageId && w.board.wsProvider
								? {
										awareness: w.board.wsProvider.awareness,
										currentPageId: w.pageId,
										switchPage: w.switchPage,
									}
								: undefined,
					})
				: null,
	},
	{
		id: "presence-cursor",
		label: "カーソル",
		needsServer: true,
		create: (w) =>
			w.wsProvider
				? createPresenceCursorPlugin({
						wsProvider: w.wsProvider,
						userId: w.user().id ?? "anonymous",
						userName: w.user().name ?? "Anonymous",
					})
				: null,
	},
	// 他の人の選択・編集・範囲選択を描く（#960）。
	{
		id: "presence-activity",
		label: "他の人の操作",
		needsServer: true,
		create: (w) =>
			w.wsProvider ? createPresenceActivityPlugin({ wsProvider: w.wsProvider }) : null,
	},
	{
		id: "presence-enhanced",
		label: "不在の人",
		needsServer: true,
		create: (w) =>
			w.wsProvider
				? createPresenceEnhancedPlugin({
						wsProvider: w.wsProvider,
						boardId: w.boardId,
						apiUrl: w.apiUrl,
					})
				: null,
	},
	{
		id: "avatar",
		label: "アバター",
		needsServer: true,
		create: (w) => {
			if (!w.wsProvider) return null;
			const user = w.user();
			return createAvatarPlugin({
				wsProvider: w.wsProvider,
				userId: user.id ?? "anonymous",
				userName: user.name ?? "Anonymous",
				userImage: user.image,
				// 操作キャラが出ている間はキャラが本人の表示なので、アバターは重ねない。
				hideAvatar: (state) => state[CHARACTER_AWARENESS_FIELD] != null,
			});
		},
	},
	// サイドパネルは `side-panel:register-tab` を聞くので、タブを足す側（コメント・活動・
	// ボード情報）より前に置く。
	{
		id: "side-panel",
		label: "サイドパネル",
		needsServer: true,
		create: () => createSidePanelPlugin(),
	},
	// ページを使うボードでは、コメントにページを記録し、一覧から別のページへ移れる。
	{
		id: "comments",
		label: "コメント",
		needsServer: true,
		create: (w) =>
			createCommentsPlugin({
				boardId: w.boardId,
				apiUrl: w.apiUrl,
				extraHeaders: w.extraHeaders,
				pages: w.pageId
					? {
							currentPageId: w.pageId,
							legacyPageId: getLegacyPageId(w.board.rootDoc),
							pageName: (id) => getPage(w.board.rootDoc, id)?.name ?? null,
							switchPage: w.switchPage,
						}
					: undefined,
			}),
	},
	// ボード履歴（サーバーの自動・手動コミット）。ページを使うボードでは今のページを見せる。
	{
		id: "history",
		label: "履歴",
		needsServer: true,
		create: (w) =>
			createHistoryPlugin({
				boardId: w.boardId,
				apiUrl: w.apiUrl,
				extraHeaders: w.extraHeaders,
				pageId: w.pageId,
			}),
	},
	{
		id: "ai",
		label: "AI",
		needsServer: true,
		create: (w) => {
			const { apiUrl, boardId, extraHeaders } = w;
			// OpenUI の LLM はサーバーの `/api/ai/openui` を通す（API キーをブラウザに出さない）。
			const openuiProvider = createServerProxyProvider({
				apiUrl,
				extraHeaders,
				boardId,
				defaultModel: import.meta.env.VITE_OPENUI_MODEL,
			});
			return [
				// ページを使うボードでは、AI の配置・更新を今のページに書く。
				createAiAgentPlugin({ apiUrl, extraHeaders, pageId: w.pageId }),
				// 内蔵の Cmd+K パレットは使わない（操作は Control HUD の検索に一本化）。
				createAiChatPlugin({ boardId, enableCommandPalette: false }),
				createAiActionsPlugin({ boardId }),
				createAiCopilotPlugin({ apiUrl, boardId, extraHeaders }),
				createAiImagePlugin({ boardId }),
				createAiRecognizePlugin({ boardId }),
				// 録音 → AI 要約 → まとめ Frame。文字起こしはサーバーの Whisper。
				createVoiceNotesPlugin({
					apiUrl,
					boardId,
					extraHeaders,
					createTranscriber: () =>
						createWhisperTranscriber({ apiUrl, boardId, extraHeaders, lang: "ja" }),
				}),
				createOpenUIShapePlugin(),
				createOpenUIToolPlugin({ provider: openuiProvider }),
			];
		},
	},
	{
		id: "whistle",
		label: "ホイッスル",
		create: (w) => createWhistlePlugin(w.wsProvider ?? undefined),
	},
	{
		id: "activity-feed",
		label: "活動",
		needsServer: true,
		create: (w) =>
			w.wsProvider
				? createActivityFeedPlugin({
						wsProvider: w.wsProvider,
						boardId: w.boardId,
						apiUrl: w.apiUrl,
					})
				: null,
	},
	{
		id: "board-info-panel",
		label: "ボードの紹介",
		needsServer: true,
		create: (w) =>
			createBoardInfoPanelPlugin({
				apiUrl: w.apiUrl,
				extraHeaders: Object.keys(w.extraHeaders).length > 0 ? w.extraHeaders : undefined,
				onOpenBoard: (id: string) => w.host.navigate?.(`/boards/${id}`),
			}),
	},
	{
		id: "community-chat",
		label: "チャット",
		needsServer: true,
		create: (w) => {
			const userId = w.user().id;
			if (!w.wsProvider || !userId) return null;
			return createCommunityChatPlugin({
				apiUrl: `${w.apiUrl}/api/boards/${w.boardId}/chat`,
				extraHeaders: Object.keys(w.extraHeaders).length > 0 ? w.extraHeaders : undefined,
				wsProvider: w.wsProvider,
				userId,
				userName: w.user().name ?? "Anonymous",
			});
		},
	},
	// 投票などのライブセッション（サーバーが進行を持つ）。userId は WS 接続の本人と同じに
	// する（開発中は ?devUserId=、本番は cookie の人）。違うとホストかどうかを取り違える。
	{
		id: "session",
		label: "ライブ投票",
		needsServer: true,
		create: (w) =>
			w.wsProvider
				? createSessionPlugin({
						wsProvider: w.wsProvider,
						boardId: w.boardId,
						userId:
							(import.meta.env.DEV ? getDevUser()?.id : undefined) ?? w.user().id ?? "anonymous",
						types: [votingClientType],
					})
				: null,
	},
	{ id: "voting", label: "投票", create: (w) => createVotingPlugin(w.wsProvider ?? undefined) },
	{
		id: "effect-ripple",
		label: "波紋",
		create: (w) => createRippleEffectPlugin(w.wsProvider ?? undefined),
	},
	{
		id: "reactions",
		label: "リアクション",
		create: (w) => createReactionsPlugin(w.wsProvider ?? undefined),
	},
	{
		id: "spatial-chat",
		label: "近くの人と話す",
		create: (w) => createSpatialChatPlugin(w.wsProvider ?? undefined),
	},
	{
		id: "keyboard-shortcuts",
		label: "キーボードショートカット",
		create: (w) =>
			createKeyboardShortcutsPlugin(w.wsProvider ? { wsProvider: w.wsProvider } : undefined),
	},
	{ id: "canvas-filter", label: "画面のフィルター", create: () => createFilterPlugin() },
	// 操作キャラ（WASD）。接続中は awareness で他の人のキャラと共存する。見た目はホストが渡す。
	{
		id: "character",
		label: "キャラ",
		create: (w) =>
			createCharacterPlugin({
				wsProvider: w.wsProvider ?? undefined,
				userName: localUserName(w),
				appearance: characterAppearance(localUserId(w)),
				renderCharacter,
				renderShadow: renderCharacterShadow,
				// 標高の坂は 45° まで歩いて登れる（map の段は maxStep のまま）。
				motion: { maxSlope: 45 },
			}),
	},
	// 共有タイマー。時刻は serverClock 基準で全員一致。
	{
		id: "timter",
		label: "タイマー",
		create: (w) => createTimterPlugin({ serverClock: w.board.serverClock, userId: localUserId(w) }),
	},
	// ゲームテーブル（croupier）。手番制のゲームだけを載せる。ログインはボードの後に届く
	// ことがあるので、ユーザーは毎回読む。接続中は抜けた人の手番をホストが代行する。
	{
		id: "croupier",
		label: "ゲームテーブル",
		create: (w) => {
			const userId = () => localUserId(w);
			const presence = w.wsProvider
				? createAwarenessPresence(w.wsProvider.awareness, userId)
				: null;
			if (presence) w.onDispose(() => presence.dispose());
			return createCroupierPlugin({
				presence: presence ?? undefined,
				// 進行中のゲームは doc の別マップに置く（テーブルを動かすたびに履歴に積まれないように）。
				gameState: createMapGameState(w.board.rootDoc.getMap("croupier")),
				player: () => ({ userId: userId(), name: localUserName(w) ?? "Guest" }),
				games: [
					defineCroupierGame({
						id: "values-card",
						label: "Values Card",
						createConfig: (options) =>
							createValuesCardConfig({
								theme: typeof options.theme === "string" ? options.theme : undefined,
							}),
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
				now: () => w.board.serverClock.now(),
			});
		},
	},
	// 任意のシェイプを画面に固定してピン。ページを使うボードでは今のページのものだけ出す。
	{
		id: "portal",
		label: "画面にピン",
		create: (w) =>
			createPortalPlugin({
				doc: w.board.rootDoc,
				boardId: w.boardId,
				userId: localUserId(w),
				pageId: w.pageId ?? undefined,
				legacyPageId: w.pageId ? getLegacyPageId(w.board.rootDoc) : null,
			}),
	},
	// 画像などの重いデータを doc の `assets` に一度だけ持ち、Shape は id で参照する。
	{
		id: "asset-store",
		label: "アセット",
		base: true,
		create: (w) => createAssetStorePlugin({ doc: w.board.rootDoc }),
	},
	// 外の Web ページの埋め込み。YouTube は再生位置を全員で合わせる。
	{
		id: "shape-embed",
		label: "埋め込み",
		create: (w) =>
			createEmbedShapePlugin({
				serverClock: w.board.serverClock,
				boardId: w.boardId,
				userId: localUserId(w),
			}),
	},
	// 発表。`?present=1` のときだけ UI を出す（URL クエリで切り替えるので App は作り直さない）。
	// マルチページでは最後のスライドの次で次のページへ進む。
	{
		id: "presentation",
		label: "発表",
		create: (w) => {
			const presentation = w.host.presentation;
			if (!presentation) return null;
			const { pageId } = w;
			return createPresentationPlugin({
				...presentation,
				pages: pageId
					? {
							hasPage: (step) => visibleNeighbor(w, pageId, step) !== null,
							goToPage: (step) => {
								const target = visibleNeighbor(w, pageId, step);
								if (target) w.switchPage(target.id);
							},
							pageLabel: () => {
								const pages = visiblePages(w);
								const index = pages.findIndex((p) => p.id === pageId);
								if (pages.length < 2 || index < 0) return null;
								return `${pages[index]?.name}（${index + 1}/${pages.length}）`;
							},
						}
					: undefined,
			});
		},
	},
	// スタート位置: 起動時に初期視点へ。deep-link より前に置き、URL の指定があればそちらに譲る。
	{
		id: "start-position",
		label: "スタート位置",
		base: true,
		create: () => createStartPositionPlugin(),
	},
	// URL ⇄ 選択・視点（Figma の ?node-id 相当）。最後のほうに置く。
	{ id: "deep-link", label: "URL で場所を共有", base: true, create: () => createDeepLinkPlugin() },
	// Control HUD（プラグインの操作をまとめる画面）。分割読み込みのまま、最後に足す。
	{
		id: "debug-hud",
		label: "HUD",
		base: true,
		create: async () => {
			const { createDebugHudPlugin } = await import("@edv4h/usketch-plugin-debug-hud");
			return createDebugHudPlugin();
		},
	},
];

/** カタログの id の一覧（テスト・プリセットの確認用）。 */
export const CATALOG_IDS: ReadonlySet<string> = new Set(PLUGIN_CATALOG.map((e) => e.id));

/**
 * ページに入れる項目を、カタログの並び順で選ぶ。ベースは必ず入り、接続の要るものは
 * 接続が無ければ外す。
 */
export function selectCatalogEntries(
	selected: ReadonlySet<string>,
	options: { connected: boolean },
	catalog: readonly CatalogEntry[] = PLUGIN_CATALOG,
): CatalogEntry[] {
	return catalog.filter(
		(entry) => (entry.base || selected.has(entry.id)) && (options.connected || !entry.needsServer),
	);
}

/** 選んだ項目からプラグインを作る（カタログの並び順）。 */
export async function createCatalogPlugins(
	selected: ReadonlySet<string>,
	w: HostWiring,
	extra: readonly UsketchPlugin[] = [],
): Promise<UsketchPlugin[]> {
	const plugins: UsketchPlugin[] = [];
	const entries = selectCatalogEntries(selected, { connected: w.wsProvider !== null });
	// HUD は最後（ホストが足すもの・開発用の場面の後）。
	const hud = entries.filter((e) => e.id === "debug-hud");
	for (const entry of entries) {
		if (entry.id === "debug-hud") continue;
		const created = await entry.create(w);
		if (created) plugins.push(...(Array.isArray(created) ? created : [created]));
	}
	plugins.push(...extra);
	for (const entry of hud) {
		const created = await entry.create(w);
		if (created) plugins.push(...(Array.isArray(created) ? created : [created]));
	}
	return plugins;
}
