import { AppProvider, Canvas, ShapeLayer, TransientLayer } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { createActivityFeedPlugin } from "@edv4h/usketch-plugin-activity-feed";
import { createAvatarPlugin } from "@edv4h/usketch-plugin-avatar";
import { createRippleEffectPlugin, rippleEffectPlugin } from "@edv4h/usketch-plugin-effect-ripple";
import { exportPlugin } from "@edv4h/usketch-plugin-export";
import { createFollowMePlugin } from "@edv4h/usketch-plugin-follow-me";
import { createLaserPlugin, laserPlugin } from "@edv4h/usketch-plugin-laser";
import { createPresenceCursorPlugin } from "@edv4h/usketch-plugin-presence-cursor";
import { createPresenceEnhancedPlugin } from "@edv4h/usketch-plugin-presence-enhanced";
import { createReactionsPlugin, reactionsPlugin } from "@edv4h/usketch-plugin-reactions";
import { counterPlugin } from "@edv4h/usketch-plugin-shape-counter";
import { ellipsePlugin } from "@edv4h/usketch-plugin-shape-ellipse";
import { freedrawPlugin } from "@edv4h/usketch-plugin-shape-freedraw";
import { rectPlugin } from "@edv4h/usketch-plugin-shape-rect";
import { textPlugin } from "@edv4h/usketch-plugin-shape-text";
import { snapPlugin } from "@edv4h/usketch-plugin-snap";
import { createSpatialChatPlugin, spatialChatPlugin } from "@edv4h/usketch-plugin-spatial-chat";
import { createSpotlightPlugin, spotlightPlugin } from "@edv4h/usketch-plugin-spotlight";
import { createYjsSync } from "@edv4h/usketch-plugin-sync-localstorage-yjs";
import { panToolPlugin } from "@edv4h/usketch-plugin-tool-pan";
import { selectToolPlugin } from "@edv4h/usketch-plugin-tool-select";
import { viewportNavPlugin } from "@edv4h/usketch-plugin-viewport-nav";
import { createVotingPlugin, votingPlugin } from "@edv4h/usketch-plugin-voting";
import type { UsketchPlugin } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import {
	createWsProvider,
	type WsConnectionStatus,
	type WsProviderHandle,
} from "@edv4h/usketch-sync";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router";
import { Toolbar } from "./components/toolbar.js";
import { getDevUser } from "./lib/dev-auth.js";
import { useAuth } from "./lib/use-auth.js";

const basePlugins: UsketchPlugin[] = [
	selectToolPlugin,
	panToolPlugin,
	viewportNavPlugin,
	rectPlugin,
	ellipsePlugin,
	freedrawPlugin,
	textPlugin,
	counterPlugin,
	snapPlugin,
	exportPlugin,
];

async function loadPlugins(extra: UsketchPlugin[]): Promise<UsketchPlugin[]> {
	const plugins = [...basePlugins, ...extra];
	if (import.meta.env.DEV) {
		const { debugHudPlugin } = await import("@edv4h/usketch-plugin-debug-hud");
		return [...plugins, debugHudPlugin];
	}
	return plugins;
}

export function App() {
	const { boardId } = useParams<{ boardId: string }>();
	const location = useLocation();
	const isCloudBoard = location.pathname.startsWith("/boards/");
	const { user: authUser } = useAuth();
	const [app, setApp] = useState<AppInstance | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [wsStatus, setWsStatus] = useState<WsConnectionStatus | null>(null);
	const wsProviderRef = useRef<WsProviderHandle | null>(null);

	// ボード初期化（boardId/isCloudBoardのみに依存）
	useEffect(() => {
		if (!boardId) return;

		let cancelled = false;
		let instance: AppInstance | null = null;
		const store = createBoardStore();
		const syncHandle = createYjsSync(store, `usketch-board-${boardId}`);

		(globalThis as Record<string, unknown>).__usketchSyncStatus = syncHandle.status;

		const extraPlugins: UsketchPlugin[] = [];
		let wsProvider: WsProviderHandle | null = null;

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

			extraPlugins.push(createRippleEffectPlugin(wsProvider));
			extraPlugins.push(createReactionsPlugin(wsProvider));
			extraPlugins.push(createLaserPlugin(wsProvider));
			extraPlugins.push(createSpatialChatPlugin(wsProvider));
			extraPlugins.push(createFollowMePlugin({ wsProvider }));
			// presenceは常にプラグインとして追加（ユーザー情報は後から設定）
			extraPlugins.push(
				createPresenceCursorPlugin({
					wsProvider,
					userId: "anonymous",
					userName: "Anonymous",
				}),
			);
			extraPlugins.push(
				createAvatarPlugin({
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
			extraPlugins.push(createSpotlightPlugin(wsProvider));
			extraPlugins.push(createVotingPlugin(wsProvider));
			extraPlugins.push(
				createActivityFeedPlugin({
					wsProvider,
					boardId,
					apiUrl,
				}),
			);
		} else {
			extraPlugins.push(rippleEffectPlugin);
			extraPlugins.push(reactionsPlugin);
			extraPlugins.push(laserPlugin);
			extraPlugins.push(spatialChatPlugin);
			extraPlugins.push(spotlightPlugin);
			extraPlugins.push(votingPlugin);
		}

		syncHandle.whenSynced
			.then(() => {
				if (cancelled) return;

				return loadPlugins(extraPlugins)
					.then((plugins) => createApp({ store, plugins }))
					.then((created) => {
						if (cancelled) {
							created.destroy();
							return;
						}
						instance = created;
						const a = instance;
						a.layers.register({
							id: "shapes",
							order: 50,
							render: (renderCtx) => <ShapeLayer ctx={renderCtx} shapeRegistry={a.shapes} />,
						});
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
					setError(e instanceof Error ? e.message : "Failed to initialize board");
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
	}, [boardId, isCloudBoard]);

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
	const authUserImage = authUser?.image;
	useEffect(() => {
		const wsProvider = wsProviderRef.current;
		if (!wsProvider || !authUserId) return;

		wsProvider.awareness.setLocalStateField("user", {
			name: authUserName ?? "Anonymous",
		});
		wsProvider.awareness.setLocalStateField("avatar", {
			name: authUserName ?? "Anonymous",
			image: authUserImage ?? null,
			userId: authUserId,
		});
	}, [authUserId, authUserName, authUserImage]);

	// キーボードショートカット
	useEffect(() => {
		if (!app) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			const tools = app.tools.getAll();
			for (const [id, def] of tools) {
				if (
					def.shortcut &&
					e.key.toLowerCase() === def.shortcut.toLowerCase() &&
					!e.ctrlKey &&
					!e.metaKey &&
					!e.altKey
				) {
					app.store.setActiveToolId(id);
					return;
				}
			}
			app.shortcuts.handleKeyDown(e);
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [app]);

	if (error) {
		return (
			<div style={{ padding: "24px", fontFamily: "system-ui, sans-serif", color: "#c33" }}>
				<p>Error: {error}</p>
				<a href="/">Back to Dashboard</a>
			</div>
		);
	}

	if (!app) return null;

	return (
		<AppProvider app={app}>
			<div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
				<Canvas />
				<Toolbar boardId={boardId} isCloudBoard={isCloudBoard} wsProvider={wsProviderRef.current} />
				{isCloudBoard && wsStatus === "failed" && (
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
				{isCloudBoard && wsStatus === "connecting" && (
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
