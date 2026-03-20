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
import { useParams } from "react-router";
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
	const [app, setApp] = useState<AppInstance | null>(null);

	useEffect(() => {
		if (!boardId) return;

		let cancelled = false;
		let instance: AppInstance | null = null;
		let syncHandle: ReturnType<typeof createYjsSync> | null = null;
		const store = createBoardStore();

		// ボードIDに基づいてYjsドキュメントを作成（ボードごとに独立）
		syncHandle = createYjsSync(store, `usketch-board-${boardId}`);

		syncHandle.whenSynced.then(() => {
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
		});

		return () => {
			cancelled = true;
			instance?.destroy();
			syncHandle?.destroy();
			setApp(null);
		};
	}, [boardId]);

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
