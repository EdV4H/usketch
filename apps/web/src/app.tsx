import { AppProvider, Canvas, ShapeLayer, TransientLayer } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { rippleEffectPlugin } from "@edv4h/usketch-plugin-effect-ripple";
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
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router";
import { Toolbar } from "./components/toolbar.js";

const basePlugins: UsketchPlugin[] = [
	selectToolPlugin,
	panToolPlugin,
	viewportNavPlugin,
	rectPlugin,
	ellipsePlugin,
	freedrawPlugin,
	textPlugin,
	counterPlugin,
	rippleEffectPlugin,
	snapPlugin,
];

async function loadPlugins(): Promise<UsketchPlugin[]> {
	if (import.meta.env.DEV) {
		const { debugHudPlugin } = await import("@edv4h/usketch-plugin-debug-hud");
		return [...basePlugins, debugHudPlugin];
	}
	return basePlugins;
}

export function App() {
	const { boardId } = useParams<{ boardId: string }>();
	const location = useLocation();
	const isCloudBoard = location.pathname.startsWith("/boards/");
	const [app, setApp] = useState<AppInstance | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!boardId) return;

		let cancelled = false;
		let instance: AppInstance | null = null;
		let syncHandle: ReturnType<typeof createYjsSync> | null = null;
		const store = createBoardStore();

		// ボードIDに基づいてYjsドキュメントを作成（ボードごとに独立）
		syncHandle = createYjsSync(store, `usketch-board-${boardId}`);

		// DebugHUD用にsyncステータスを公開
		(globalThis as Record<string, unknown>).__usketchSyncStatus = syncHandle.status;

		// Cloud Boardの場合はWebSocket接続を開始
		if (isCloudBoard) {
			const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
			const wsUrl = `${apiUrl.replace(/^http/, "ws")}/api/boards/${boardId}/ws`;
			syncHandle.connectWebSocket(wsUrl);
		}

		syncHandle.whenSynced
			.then(() => {
				if (cancelled) return;

				return loadPlugins()
					.then((plugins) => createApp({ store, plugins }))
					.then((created) => {
						if (cancelled) {
							created.destroy();
							return;
						}
						instance = created;
						const app = instance;
						app.layers.register({
							id: "shapes",
							order: 50,
							render: (renderCtx) => <ShapeLayer ctx={renderCtx} shapeRegistry={app.shapes} />,
						});
						app.layers.register({
							id: "transient",
							order: 100,
							render: (renderCtx) => <TransientLayer registry={app.transient} ctx={renderCtx} />,
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
			syncHandle?.destroy();
			delete (globalThis as Record<string, unknown>).__usketchSyncStatus;
			setApp(null);
		};
	}, [boardId, isCloudBoard]);

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
