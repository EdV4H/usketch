import { AppProvider, Canvas, ShapeLayer, TransientLayer } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { createRippleEffectPlugin, rippleEffectPlugin } from "@edv4h/usketch-plugin-effect-ripple";
import { createPresenceCursorPlugin } from "@edv4h/usketch-plugin-presence-cursor";
import { counterPlugin } from "@edv4h/usketch-plugin-shape-counter";
import { ellipsePlugin } from "@edv4h/usketch-plugin-shape-ellipse";
import { freedrawPlugin } from "@edv4h/usketch-plugin-shape-freedraw";
import { rectPlugin } from "@edv4h/usketch-plugin-shape-rect";
import { textPlugin } from "@edv4h/usketch-plugin-shape-text";
import { snapPlugin } from "@edv4h/usketch-plugin-snap";
import { createYjsSync } from "@edv4h/usketch-plugin-sync-localstorage-yjs";
import { panToolPlugin } from "@edv4h/usketch-plugin-tool-pan";
import { selectToolPlugin } from "@edv4h/usketch-plugin-tool-select";
import { viewportNavPlugin } from "@edv4h/usketch-plugin-viewport-nav";
import type { UsketchPlugin } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { createWsProvider } from "@edv4h/usketch-sync";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router";
import { Toolbar } from "./components/toolbar.js";
import { useSession } from "./lib/auth-client.js";

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
	const { data: session } = useSession();
	const sessionUserId = session?.user?.id;
	const sessionUserName = session?.user?.name ?? "Anonymous";
	const [app, setApp] = useState<AppInstance | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!boardId) return;

		let cancelled = false;
		let instance: AppInstance | null = null;
		const store = createBoardStore();
		const syncHandle = createYjsSync(store, `usketch-board-${boardId}`);

		// DebugHUD用にsyncステータスを公開
		(globalThis as Record<string, unknown>).__usketchSyncStatus = syncHandle.status;

		// Cloud Boardの場合はWebSocket接続 + プレゼンス/エフェクト同期
		const extraPlugins: UsketchPlugin[] = [];
		let wsProvider: ReturnType<typeof createWsProvider> | null = null;

		if (isCloudBoard) {
			const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
			const wsUrl = `${apiUrl.replace(/^http/, "ws")}/api/boards/${boardId}/ws`;
			wsProvider = createWsProvider({ url: wsUrl, doc: syncHandle.doc });

			extraPlugins.push(createRippleEffectPlugin(wsProvider));
			if (sessionUserId) {
				extraPlugins.push(
					createPresenceCursorPlugin({
						wsProvider,
						userId: sessionUserId,
						userName: sessionUserName,
					}),
				);
			}
		} else {
			extraPlugins.push(rippleEffectPlugin);
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
			syncHandle.destroy();
			delete (globalThis as Record<string, unknown>).__usketchSyncStatus;
			setApp(null);
		};
	}, [boardId, isCloudBoard, sessionUserId, sessionUserName]);

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
				<Toolbar />
			</div>
		</AppProvider>
	);
}
