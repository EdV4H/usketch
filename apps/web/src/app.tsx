import { AppProvider, Canvas, ShapeLayer, TransientLayer } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { rippleEffectPlugin } from "@edv4h/usketch-plugin-effect-ripple";
import { counterPlugin } from "@edv4h/usketch-plugin-shape-counter";
import { ellipsePlugin } from "@edv4h/usketch-plugin-shape-ellipse";
import { freedrawPlugin } from "@edv4h/usketch-plugin-shape-freedraw";
import { rectPlugin } from "@edv4h/usketch-plugin-shape-rect";
import { textPlugin } from "@edv4h/usketch-plugin-shape-text";
import { snapPlugin } from "@edv4h/usketch-plugin-snap";
import {
	type AwarenessState,
	createYjsSync,
	type WsProviderHandle,
} from "@edv4h/usketch-plugin-sync-localstorage-yjs";
import { panToolPlugin } from "@edv4h/usketch-plugin-tool-pan";
import { selectToolPlugin } from "@edv4h/usketch-plugin-tool-select";
import { viewportNavPlugin } from "@edv4h/usketch-plugin-viewport-nav";
import type { UsketchPlugin } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router";
import { Toolbar } from "./components/toolbar.js";
import { useSession } from "./lib/auth-client.js";

const CURSOR_COLORS = [
	"#e74c3c",
	"#3498db",
	"#2ecc71",
	"#f39c12",
	"#9b59b6",
	"#1abc9c",
	"#e67e22",
	"#e84393",
];

function getUserColor(userId: string): string {
	let hash = 0;
	for (let i = 0; i < userId.length; i++) {
		hash = (hash * 31 + userId.charCodeAt(i)) | 0;
	}
	return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

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
	const { data: session } = useSession();
	const [app, setApp] = useState<AppInstance | null>(null);
	const [error, setError] = useState<string | null>(null);
	const wsProviderRef = useRef<WsProviderHandle | null>(null);

	useEffect(() => {
		if (!boardId) return;

		let cancelled = false;
		let instance: AppInstance | null = null;
		const store = createBoardStore();
		const syncHandle = createYjsSync(store, `usketch-board-${boardId}`);

		// DebugHUD用にsyncステータスを公開
		(globalThis as Record<string, unknown>).__usketchSyncStatus = syncHandle.status;

		// Cloud Boardの場合はWebSocket接続を開始
		if (isCloudBoard) {
			const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
			const wsUrl = `${apiUrl.replace(/^http/, "ws")}/api/boards/${boardId}/ws`;
			const provider = syncHandle.connectWebSocket(wsUrl);
			wsProviderRef.current = provider;
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
			syncHandle.destroy();
			wsProviderRef.current = null;
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

	// リモートカーソル — Awarenessの受信をTransientRegistryに変換
	useEffect(() => {
		const provider = wsProviderRef.current;
		if (!app || !provider) return;

		const unsubscribe = provider.onAwarenessChange((states: Map<string, AwarenessState>) => {
			// 既存のリモートカーソルをクリア
			for (const [, obj] of app.transient.getAll()) {
				if (obj.type === "remote-cursor") {
					app.transient.dismiss(obj.id);
				}
			}
			// リモートカーソルをemit
			for (const [userId, state] of states) {
				if (state.cursor) {
					app.transient.emit({
						id: `cursor-${userId}`,
						type: "remote-cursor",
						sourceUserId: userId,
						position: state.cursor,
						data: { name: state.name, color: state.color },
						ttl: 5000,
						createdAt: Date.now(),
					});
				}
			}
		});

		return unsubscribe;
	}, [app]);

	// ローカルカーソル — mousemoveをAwareness経由で送信
	useEffect(() => {
		const provider = wsProviderRef.current;
		if (!app || !provider || !session?.user) return;

		const userId = session.user.id;
		const userName = session.user.name ?? "Anonymous";
		const color = getUserColor(userId);

		const handleMouseMove = (e: MouseEvent) => {
			const viewport = app.store.getViewport();
			const x = (e.clientX - viewport.x) / viewport.zoom;
			const y = (e.clientY - viewport.y) / viewport.zoom;

			provider.setAwareness({
				userId,
				name: userName,
				color,
				cursor: { x, y },
			});
		};

		const handleMouseLeave = () => {
			provider.setAwareness({
				userId,
				name: userName,
				color,
				cursor: null,
			});
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseleave", handleMouseLeave);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseleave", handleMouseLeave);
		};
	}, [app, session]);

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
