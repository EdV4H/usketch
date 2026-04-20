import { AppProvider, Canvas, TransientLayer } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { createDomRendererPlugin } from "@edv4h/usketch-dom-renderer";
import { createGpuRendererPlugin } from "@edv4h/usketch-gpu-renderer";
import { createAiActionsPlugin } from "@edv4h/usketch-plugin-ai-actions";
import { createAiAgentPlugin } from "@edv4h/usketch-plugin-ai-agent";
import { createAiChatPlugin } from "@edv4h/usketch-plugin-ai-chat";
import { createAiCopilotPlugin } from "@edv4h/usketch-plugin-ai-copilot";
import { createAiImagePlugin } from "@edv4h/usketch-plugin-ai-image";
import { createAiRecognizePlugin } from "@edv4h/usketch-plugin-ai-recognize";
import { createAiVoicePlugin } from "@edv4h/usketch-plugin-ai-voice";
import { dotsBgPlugin } from "@edv4h/usketch-plugin-bg-dots";
import { gridBgPlugin } from "@edv4h/usketch-plugin-bg-grid";
import { createCommentsPlugin } from "@edv4h/usketch-plugin-comments";
import { exportPlugin } from "@edv4h/usketch-plugin-export";
import { createFollowMePlugin } from "@edv4h/usketch-plugin-follow-me";
import { createLaserPlugin, laserPlugin } from "@edv4h/usketch-plugin-laser";
import { createPresenceCursorPlugin } from "@edv4h/usketch-plugin-presence-cursor";
import { createPresenceEnhancedPlugin } from "@edv4h/usketch-plugin-presence-enhanced";
import { createPresentationPlugin } from "@edv4h/usketch-plugin-presentation";
import { basicShapePlugin } from "@edv4h/usketch-plugin-shape-basic";
import { connectorPlugin } from "@edv4h/usketch-plugin-shape-connector";
import { counterPlugin } from "@edv4h/usketch-plugin-shape-counter";
import { framePlugin } from "@edv4h/usketch-plugin-shape-frame";
import { freedrawPlugin } from "@edv4h/usketch-plugin-shape-freedraw";
import { groupPlugin } from "@edv4h/usketch-plugin-shape-group";
import { imageShapePlugin } from "@edv4h/usketch-plugin-shape-image";
import { stickyPlugin } from "@edv4h/usketch-plugin-shape-sticky";
import { textPlugin } from "@edv4h/usketch-plugin-shape-text";
import { wireframePlugin } from "@edv4h/usketch-plugin-shape-wireframe";
import { createSidePanelPlugin } from "@edv4h/usketch-plugin-side-panel";
import { snapPlugin } from "@edv4h/usketch-plugin-snap";
import { createSpotlightPlugin, spotlightPlugin } from "@edv4h/usketch-plugin-spotlight";
import { createYjsSync } from "@edv4h/usketch-plugin-sync-localstorage-yjs";
import { panToolPlugin } from "@edv4h/usketch-plugin-tool-pan";
import { selectToolPlugin } from "@edv4h/usketch-plugin-tool-select";
import { viewportNavPlugin } from "@edv4h/usketch-plugin-viewport-nav";
import { createWhistlePlugin, whistlePlugin } from "@edv4h/usketch-plugin-whistle";
import type { UsketchPlugin } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import {
	createWsProvider,
	type WsConnectionStatus,
	type WsProviderHandle,
} from "@edv4h/usketch-sync";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { Toolbar } from "./components/toolbar/index.js";
import { getDevUser } from "./lib/dev-auth.js";
import { getErrorMessage } from "./lib/errors.js";
import { useAuth } from "./lib/use-auth.js";
import { useKeyboardShortcuts } from "./lib/use-keyboard-shortcuts.js";

type Flavor = "whiteboard" | "presentation";

function buildBasePlugins(flavor: Flavor): UsketchPlugin[] {
	const common: UsketchPlugin[] = [
		selectToolPlugin,
		panToolPlugin,
		viewportNavPlugin,
		basicShapePlugin,
		groupPlugin,
		framePlugin,
		connectorPlugin,
		freedrawPlugin,
		textPlugin,
		stickyPlugin,
		imageShapePlugin,
		counterPlugin,
		wireframePlugin,
		exportPlugin,
		createGpuRendererPlugin(),
		createDomRendererPlugin(),
	];
	if (flavor === "presentation") {
		// 発表/編集ともに背景グリッドとスナップは外す（ノイズになる）
		return common;
	}
	return [gridBgPlugin, dotsBgPlugin, snapPlugin, ...common];
}

async function loadPlugins(flavor: Flavor, extra: UsketchPlugin[]): Promise<UsketchPlugin[]> {
	const plugins = [...buildBasePlugins(flavor), ...extra];
	if (import.meta.env.DEV) {
		const { debugHudPlugin } = await import("@edv4h/usketch-plugin-debug-hud");
		return [...plugins, debugHudPlugin];
	}
	return plugins;
}

export function App() {
	const { boardId } = useParams<{ boardId: string }>();
	const location = useLocation();
	const navigate = useNavigate();
	const isCloudBoard = location.pathname.startsWith("/boards/");
	const isPresentationFlavor = location.pathname.startsWith("/presentation/");
	const flavor: Flavor = isPresentationFlavor ? "presentation" : "whiteboard";
	const presentationMode: "edit" | "present" =
		new URLSearchParams(location.search).get("mode") === "present" ? "present" : "edit";
	// presentation flavor もクラウド（DB + Yjs 同期）を既定とする
	const useCloudSync = isCloudBoard || isPresentationFlavor;
	const { user: authUser } = useAuth();

	// 最新の mode を useEffect 外部から参照するための ref。
	// effect 依存に presentationMode を入れてしまうと切替のたびに app インスタンスが
	// 作り直され、undo 履歴や WebSocket が吹き飛ぶ（Copilot 指摘）。
	const modeRef = useRef<"edit" | "present">(presentationMode);
	modeRef.current = presentationMode;
	const [app, setApp] = useState<AppInstance | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [wsStatus, setWsStatus] = useState<WsConnectionStatus | null>(null);
	const wsProviderRef = useRef<WsProviderHandle | null>(null);

	// ボード初期化（boardId / isCloudBoard / flavor / useCloudSync に依存）。
	// presentationMode は依存に入れていない（下の NOTE 参照）。
	useEffect(() => {
		if (!boardId) return;

		let cancelled = false;
		let instance: AppInstance | null = null;
		const store = createBoardStore();
		const syncHandle = createYjsSync(store, `usketch-board-${boardId}`);

		(globalThis as Record<string, unknown>).__usketchSyncStatus = syncHandle.status;

		const extraPlugins: UsketchPlugin[] = [];
		let wsProvider: WsProviderHandle | null = null;

		if (useCloudSync) {
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
		}

		if (flavor === "presentation") {
			// プレゼン flavor は最小構成: presentation プラグイン + 協調プレゼン向けの3種
			// mode は URL で動的に変わるので ref 経由で渡す（再レンダリングの契機は plugin が popstate で受ける）
			extraPlugins.push(
				createPresentationPlugin({
					getMode: () => modeRef.current,
					// フル reload を避けるため react-router の navigate を注入する
					navigateToBoard: () => {
						if (boardId) navigate(`/boards/${boardId}`);
					},
				}),
			);
			if (wsProvider) {
				extraPlugins.push(createLaserPlugin(wsProvider));
				extraPlugins.push(createSpotlightPlugin(wsProvider));
				extraPlugins.push(createFollowMePlugin({ wsProvider }));
			}
		} else if (isCloudBoard && wsProvider) {
			const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

			extraPlugins.push(createLaserPlugin(wsProvider));
			extraPlugins.push(createSpotlightPlugin(wsProvider));
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
			extraPlugins.push(createAiChatPlugin({ boardId }));
			extraPlugins.push(createAiActionsPlugin({ boardId }));
			extraPlugins.push(createAiCopilotPlugin({ apiUrl, boardId, extraHeaders: aiHeaders }));
			extraPlugins.push(createAiVoicePlugin({ boardId }));
			extraPlugins.push(createAiImagePlugin({ boardId }));
			extraPlugins.push(createAiRecognizePlugin({ boardId }));
			extraPlugins.push(createWhistlePlugin(wsProvider));
		} else {
			extraPlugins.push(laserPlugin);
			extraPlugins.push(spotlightPlugin);
			extraPlugins.push(whistlePlugin);
		}

		syncHandle.whenSynced
			.then(() => {
				if (cancelled) return;

				return loadPlugins(flavor, extraPlugins)
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
			syncHandle.destroy();
			delete (globalThis as Record<string, unknown>).__usketchSyncStatus;
			setApp(null);
		};
		// NOTE: presentationMode は依存に入れない。mode 切替では app を再作成せず、
		// plugin 側が modeRef 経由で最新値を読む（undo 履歴・WebSocket を残すため）。
	}, [boardId, isCloudBoard, flavor, useCloudSync, navigate]);

	// ページ離脱時にビューポート位置を保存（ゴーストアバター用）
	// プレゼン flavor も cloud 同期を使うので useCloudSync で判定する
	useEffect(() => {
		if (!useCloudSync || !boardId) return;

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
	}, [boardId, useCloudSync]);

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

	// キーボードショートカット
	useKeyboardShortcuts(app);

	if (error) {
		return (
			<div style={{ padding: "24px", fontFamily: "system-ui, sans-serif", color: "#c33" }}>
				<p>Error: {error}</p>
				<a href="/">Back to Dashboard</a>
			</div>
		);
	}

	if (!app) return null;

	const hideToolbar = flavor === "presentation" && presentationMode === "present";

	return (
		<AppProvider app={app}>
			<div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
				<Canvas />
				{!hideToolbar && <Toolbar boardId={boardId} isCloudBoard={isCloudBoard} />}
				{useCloudSync && wsStatus === "failed" && (
					<div
						style={{
							position: "fixed",
							bottom: 16,
							left: "50%",
							transform: "translateX(-50%)",
							background: "#c33",
							color: "#fff",
							padding: "8px 20px",
							borderRadius: 8,
							fontSize: 13,
							fontFamily: "system-ui, sans-serif",
							boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
							zIndex: 200,
						}}
					>
						Unable to connect — you may not have access to this board
					</div>
				)}
				{useCloudSync && wsStatus === "connecting" && (
					<div
						style={{
							position: "fixed",
							bottom: 16,
							left: "50%",
							transform: "translateX(-50%)",
							background: "#f90",
							color: "#fff",
							padding: "8px 20px",
							borderRadius: 8,
							fontSize: 13,
							fontFamily: "system-ui, sans-serif",
							boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
							zIndex: 200,
						}}
					>
						Connecting...
					</div>
				)}
			</div>
		</AppProvider>
	);
}
