import { AppProvider, Canvas, TransientLayer } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { createDomRendererPlugin } from "@edv4h/usketch-dom-renderer";
import { createGpuRendererPlugin } from "@edv4h/usketch-gpu-renderer";
import { createActivityFeedPlugin } from "@edv4h/usketch-plugin-activity-feed";
import { createAiActionsPlugin } from "@edv4h/usketch-plugin-ai-actions";
import { createAiAgentPlugin } from "@edv4h/usketch-plugin-ai-agent";
import { createAiChatPlugin } from "@edv4h/usketch-plugin-ai-chat";
import { createAiCopilotPlugin } from "@edv4h/usketch-plugin-ai-copilot";
import { createAiImagePlugin } from "@edv4h/usketch-plugin-ai-image";
import { createAiRecognizePlugin } from "@edv4h/usketch-plugin-ai-recognize";
import { createAiVoicePlugin } from "@edv4h/usketch-plugin-ai-voice";
import { createDotsBgPlugin } from "@edv4h/usketch-plugin-bg-dots";
import { createGridBgPlugin } from "@edv4h/usketch-plugin-bg-grid";
import { createCommentsPlugin } from "@edv4h/usketch-plugin-comments";
import { createAttachablePlugin, createContainerPlugin } from "@edv4h/usketch-plugin-container";
import { createDomainDesignPlugin } from "@edv4h/usketch-plugin-domain-design";
import { createExportPlugin } from "@edv4h/usketch-plugin-export";
import { createFollowMePlugin } from "@edv4h/usketch-plugin-follow-me";
import { createFreePositionPlugin } from "@edv4h/usketch-plugin-free-position";
import { createLaserPlugin } from "@edv4h/usketch-plugin-laser";
import { createPresenceCursorPlugin } from "@edv4h/usketch-plugin-presence-cursor";
import { createPresenceEnhancedPlugin } from "@edv4h/usketch-plugin-presence-enhanced";
import { createPresentationPlugin } from "@edv4h/usketch-plugin-presentation";
import { createBasicShapePlugin } from "@edv4h/usketch-plugin-shape-basic";
import { createCardPlugin, EXAMPLE_CARD_TYPES } from "@edv4h/usketch-plugin-shape-card";
import { createConnectorPlugin } from "@edv4h/usketch-plugin-shape-connector";
import { createCounterPlugin } from "@edv4h/usketch-plugin-shape-counter";
import { createFramePlugin } from "@edv4h/usketch-plugin-shape-frame";
import { createFreedrawPlugin } from "@edv4h/usketch-plugin-shape-freedraw";
import { createGroupPlugin } from "@edv4h/usketch-plugin-shape-group";
import { createImageShapePlugin } from "@edv4h/usketch-plugin-shape-image";
import { createOpenUIShapePlugin } from "@edv4h/usketch-plugin-shape-openui";
import { createStickyPlugin } from "@edv4h/usketch-plugin-shape-sticky";
import { createTextPlugin } from "@edv4h/usketch-plugin-shape-text";
import { createWireframePlugin } from "@edv4h/usketch-plugin-shape-wireframe";
import { createSidePanelPlugin } from "@edv4h/usketch-plugin-side-panel";
import { createSnapPlugin } from "@edv4h/usketch-plugin-snap";
import { createSpotlightPlugin } from "@edv4h/usketch-plugin-spotlight";
import { createYjsSync } from "@edv4h/usketch-plugin-sync-localstorage-yjs";
import {
	createDivergenceTracker,
	type DivergenceTrackerHandle,
	UnconfirmedOverlay,
} from "@edv4h/usketch-plugin-sync-ywebsocket";
import {
	createOpenUIToolPlugin,
	createServerProxyProvider,
} from "@edv4h/usketch-plugin-tool-openui";
import { createPanToolPlugin } from "@edv4h/usketch-plugin-tool-pan";
import { createSelectToolPlugin } from "@edv4h/usketch-plugin-tool-select";
import { createVimToolPlugin } from "@edv4h/usketch-plugin-tool-vim";
import { createViewportNavPlugin } from "@edv4h/usketch-plugin-viewport-nav";
import { createWhistlePlugin } from "@edv4h/usketch-plugin-whistle";
import type { UsketchPlugin } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import {
	createWsProvider,
	type WsConnectionStatus,
	type WsProviderHandle,
} from "@edv4h/usketch-sync";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router";
import {
	BoardIdentity,
	CommunityLink,
	CopilotPill,
	TopRightCluster,
	ZoomControls,
} from "./components/board-frame/index.js";
import { CommandPalette, useCommandPaletteShortcut } from "./components/command-palette.js";
import { InfoTab } from "./components/side-panel/info-tab.js";
import { SidePanelToggles } from "./components/side-panel/side-panel-toggles.js";
import { Toolbar } from "./components/toolbar/index.js";
import { getDevUser } from "./lib/dev-auth.js";
import { getErrorMessage } from "./lib/errors.js";
import { localBoards } from "./lib/local-boards.js";
import { computePresentStage, type StageRect } from "./lib/present-stage.js";
import { useAuth } from "./lib/use-auth.js";
import { useKeyboardShortcuts } from "./lib/use-keyboard-shortcuts.js";

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

interface CardHandWiring {
	userId: string;
	boardId?: string;
	wsProvider?: WsProviderHandle | null;
}

function createBasePlugins(cardHand: CardHandWiring): UsketchPlugin[] {
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
		createBasicShapePlugin(),
		createGroupPlugin(),
		createFramePlugin(),
		createConnectorPlugin(),
		createFreedrawPlugin(),
		createTextPlugin(),
		createStickyPlugin(),
		createCardPlugin({
			cardTypes: EXAMPLE_CARD_TYPES,
			userId: cardHand.userId,
			boardId: cardHand.boardId,
			wsProvider: cardHand.wsProvider ?? undefined,
		}),
		createImageShapePlugin(),
		createCounterPlugin(),
		createWireframePlugin(),
		createDomainDesignPlugin(),
		createSnapPlugin(),
		createFreePositionPlugin(),
		createContainerPlugin(),
		createAttachablePlugin(),
		createExportPlugin(),
		createGpuRendererPlugin(),
		createDomRendererPlugin(),
	];
}

async function loadPlugins(
	extra: UsketchPlugin[],
	cardHand: CardHandWiring,
): Promise<UsketchPlugin[]> {
	const plugins = [...createBasePlugins(cardHand), ...extra];
	// Control HUD (universal plugin-operation panel). Promoted from DEV-only to a
	// first-class, always-available panel — hidden by default, toggled with `` ` ``.
	// Kept as a dynamic import so it stays code-split.
	const { createDebugHudPlugin } = await import("@edv4h/usketch-plugin-debug-hud");
	return [...plugins, createDebugHudPlugin()];
}

/**
 * Board メタ情報（タイトル / Cloud か Local か / id）を Control HUD に供給する
 * 小さなリアクティブストア。HUD は `globalThis.__usketchBoardMeta` を購読して
 * General パネルに表示する（`__usketchSyncStatus` と同じ受け渡し方式）。
 * モジュールスコープで生成しておくことで、プラグイン setup 時点で必ず存在する。
 */
type BoardMetaValue = { id?: string; name: string | null; isCloud: boolean };
const boardMetaStore = (() => {
	let snapshot: BoardMetaValue = { name: null, isCloud: false };
	const listeners = new Set<() => void>();
	return {
		getSnapshot: () => snapshot,
		set(next: BoardMetaValue) {
			if (
				snapshot.id === next.id &&
				snapshot.name === next.name &&
				snapshot.isCloud === next.isCloud
			) {
				return;
			}
			snapshot = next;
			for (const l of listeners) l();
		},
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
})();
(globalThis as Record<string, unknown>).__usketchBoardMeta = boardMetaStore;

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

	// 最新のユーザー id を board-init effect の依存に入れずに参照するための ref
	// （modeRef と同じ理由: 依存に入れると auth 解決のたびに board が作り直される）。
	// 手札(hand)のローカル保持キー / awareness 枚数共有の userId に使う。
	const userIdRef = useRef<string | undefined>(authUser?.id);
	userIdRef.current = authUser?.id;

	// react-router の navigate() は pushState ベースで popstate を発火しない。
	// presentation plugin は popstate で modeRef を再読込する設計なので、
	// ?present= の変化を検出したら明示的に popstate を dispatch する。
	// biome-ignore lint/correctness/useExhaustiveDependencies: presentationMode の変化をトリガーとして使用
	useEffect(() => {
		window.dispatchEvent(new PopStateEvent("popstate"));
	}, [presentationMode]);
	const [app, setApp] = useState<AppInstance | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [wsStatus, setWsStatus] = useState<WsConnectionStatus | null>(null);
	const [boardName, setBoardName] = useState<string | null>(null);
	const wsProviderRef = useRef<WsProviderHandle | null>(null);

	// プレゼン編集モードの stage 矩形 (Canvas を縮退させて配置する)。
	// app 生成 useEffect で presentation plugin に getViewportSize として渡すため、
	// ref でも保持する (stage 変更時に app を再生成しない)。
	const stageRectRef = useRef<StageRect | null>(
		presentationMode === "edit"
			? computePresentStage({ width: window.innerWidth, height: window.innerHeight })
			: null,
	);

	// ボード初期化（boardId / isCloudBoard に依存）。
	// presentationMode は依存に入れない（presentation plugin が popstate で modeRef を読み直す）。
	useEffect(() => {
		if (!boardId) return;

		let cancelled = false;
		let instance: AppInstance | null = null;
		const store = createBoardStore();
		const syncHandle = createYjsSync(store, `usketch-board-${boardId}`);

		(globalThis as Record<string, unknown>).__usketchSyncStatus = syncHandle.status;

		const extraPlugins: UsketchPlugin[] = [];
		let wsProvider: WsProviderHandle | null = null;
		// Divergence tracker — surfaces shapes that exist in the local Y.Doc
		// but the server hasn't acknowledged. Wired up only for cloud boards
		// because local boards never round-trip with a server.
		let divergenceHandle: DivergenceTrackerHandle | null = null;

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
			wsProvider = createWsProvider({ url: wsUrl, doc: syncHandle.doc });
			wsProviderRef.current = wsProvider;
			wsProvider.onStatusChange(setWsStatus);

			// Replace the IDB-only sync status (which can't see server divergence)
			// with the divergence-aware tracker for cloud boards. The Debug HUD and
			// the canvas overlay both read from `__usketchSyncStatus`.
			const wsP = wsProvider;
			divergenceHandle = createDivergenceTracker({
				store,
				doc: syncHandle.doc,
				shapesMap: syncHandle.doc.getMap<Record<string, unknown>>("shapes"),
				onConnectionStatusChange: (handler) => wsP.onStatusChange(handler),
			});
			(globalThis as Record<string, unknown>).__usketchSyncStatus = divergenceHandle.status;

			extraPlugins.push(createLaserPlugin(wsProvider));
			extraPlugins.push(createSpotlightPlugin(wsProvider));
			extraPlugins.push(createFollowMePlugin({ wsProvider }));
			extraPlugins.push(
				createPresenceCursorPlugin({
					wsProvider,
					userId: "anonymous",
					userName: "Anonymous",
				}),
			);
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

			extraPlugins.push(createCommentsPlugin({ boardId, apiUrl, extraHeaders: aiHeaders }));

			// AI プラグイン
			extraPlugins.push(createAiAgentPlugin({ apiUrl, extraHeaders: aiHeaders }));
			// Cmd+K の UI は apps/web 側の CommandPalette が担当するため無効化
			extraPlugins.push(createAiChatPlugin({ boardId, enableCommandPalette: false }));
			extraPlugins.push(createAiActionsPlugin({ boardId }));
			extraPlugins.push(createAiCopilotPlugin({ apiUrl, boardId, extraHeaders: aiHeaders }));
			extraPlugins.push(createAiVoicePlugin({ boardId }));
			extraPlugins.push(createAiImagePlugin({ boardId }));
			extraPlugins.push(createAiRecognizePlugin({ boardId }));

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
		} else {
			extraPlugins.push(createLaserPlugin());
			extraPlugins.push(createSpotlightPlugin());
			extraPlugins.push(createWhistlePlugin());
		}

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
			}),
		);

		syncHandle.whenSynced
			.then(() => {
				if (cancelled) return;

				return loadPlugins(extraPlugins, {
					userId: userIdRef.current ?? getDevUser()?.id ?? "local",
					boardId,
					wsProvider,
				})
					.then((plugins) => createApp({ store, plugins }))
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

						setApp(instance);
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
			wsProvider?.destroy();
			wsProviderRef.current = null;
			divergenceHandle?.destroy();
			syncHandle.destroy();
			delete (globalThis as Record<string, unknown>).__usketchSyncStatus;
			setApp(null);
		};
		// NOTE: presentationMode は依存に入れない。?present の切替では app を再作成せず、
		// presentation plugin が modeRef 経由で最新値を読む（undo 履歴・WebSocket を残すため）。
	}, [boardId, isCloudBoard, navigate]);

	// Cloud ボードのタイトル取得（BoardIdentity 表示用）
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

	const [paletteOpen, setPaletteOpen] = useState(false);
	const openPalette = useCallback(() => setPaletteOpen(true), []);
	useCommandPaletteShortcut(openPalette);

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

	if (!app) return null;

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
					エディタ全体 (Canvas + Toolbar + BoardIdentity 等) をひとつの div で包む。
					プレゼン編集モード中は stage 矩形に縮め、外側を発表 UI が取り囲む形にする。
					transform を当てると内側の position: fixed 要素の containing block が
					この div になるため、Toolbar 等を書き換えずに相対化できる (CSS spec)。
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
					{!hideToolbar && (
						<>
							<BoardIdentity />
							{!isPresentEdit && (
								<TopRightCluster
									boardId={boardId}
									isCloudBoard={isCloudBoard}
									wsProvider={wsProviderRef.current}
								/>
							)}
							<Toolbar
								boardId={boardId}
								isCloudBoard={isCloudBoard}
								wsProvider={wsProviderRef.current}
								onOpenCommandPalette={openPalette}
								compact={isPresentEdit}
							/>
							{!isPresentEdit && <ZoomControls />}
							{!isPresentEdit && <CommunityLink />}
							{isCloudBoard && !isPresentEdit && <SidePanelToggles app={app} />}
							{isCloudBoard && !isPresentEdit && <CopilotPill onOpenCommandPalette={openPalette} />}
						</>
					)}
				</div>
				{/* 閉じタグ: エディタ全体ラッパーの終わり */}
				<CommandPalette
					open={paletteOpen}
					onClose={() => setPaletteOpen(false)}
					app={app}
					boardId={boardId}
					isCloudBoard={isCloudBoard}
				/>
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
