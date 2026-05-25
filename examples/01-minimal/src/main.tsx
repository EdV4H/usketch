import { AppProvider, Canvas } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { createDomRendererPlugin } from "@edv4h/usketch-dom-renderer";
import { basicShapePlugin } from "@edv4h/usketch-plugin-shape-basic";
import { panToolPlugin } from "@edv4h/usketch-plugin-tool-pan";
import { selectToolPlugin } from "@edv4h/usketch-plugin-tool-select";
import { DEFAULT_STYLE } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

function App() {
	const [app, setApp] = useState<AppInstance | null>(null);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		let cancelled = false;
		let instance: AppInstance | null = null;
		const store = createBoardStore();

		createApp({
			store,
			plugins: [basicShapePlugin, selectToolPlugin, panToolPlugin, createDomRendererPlugin()],
		})
			.then((created) => {
				if (cancelled) {
					created.destroy();
					return;
				}
				instance = created;
				store.addShape({
					id: "rect-1",
					type: "rectangle",
					x: 200,
					y: 150,
					width: 240,
					height: 160,
					style: { ...DEFAULT_STYLE, fill: "#8b5cf6", stroke: "#a78bfa" },
				});
				store.setActiveToolId("select");
				setApp(created);
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				console.error("createApp failed", err);
				setError(err instanceof Error ? err : new Error(String(err)));
			});

		return () => {
			cancelled = true;
			instance?.destroy();
		};
	}, []);

	if (error) {
		return (
			<div style={{ padding: 16, color: "#fda4af" }}>Failed to start uSketch: {error.message}</div>
		);
	}
	if (!app) return <div style={{ padding: 16 }}>Loading…</div>;
	return (
		<AppProvider app={app}>
			<Canvas />
		</AppProvider>
	);
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");
createRoot(rootEl).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
