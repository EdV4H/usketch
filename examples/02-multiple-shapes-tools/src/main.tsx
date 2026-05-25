import { AppProvider, Canvas, useStoreSubscribe } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { createDomRendererPlugin } from "@edv4h/usketch-dom-renderer";
import { gridBgPlugin } from "@edv4h/usketch-plugin-bg-grid";
import { basicShapePlugin } from "@edv4h/usketch-plugin-shape-basic";
import { DEFAULT_STICKY_COLOR, stickyPlugin } from "@edv4h/usketch-plugin-shape-sticky";
import { panToolPlugin } from "@edv4h/usketch-plugin-tool-pan";
import { selectToolPlugin } from "@edv4h/usketch-plugin-tool-select";
import { viewportNavPlugin } from "@edv4h/usketch-plugin-viewport-nav";
import { DEFAULT_STYLE, type ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

interface StickyShape extends ShapeData {
	text: string;
	fontSize: number;
	stickyColor: string;
	isEditing: boolean;
}

function ToolSwitcher({ app }: { app: AppInstance }) {
	const activeId = useStoreSubscribe(app.store, (store) => store.getActiveToolId());
	const tools: Array<{ id: string; label: string }> = [
		{ id: "select", label: "Select" },
		{ id: "pan", label: "Pan" },
	];
	return (
		<div
			style={{
				position: "absolute",
				top: 12,
				left: 12,
				display: "flex",
				gap: 4,
				padding: 4,
				background: "rgba(20, 20, 22, 0.85)",
				border: "1px solid rgba(255, 255, 255, 0.1)",
				borderRadius: 6,
				zIndex: 10,
			}}
		>
			{tools.map((tool) => {
				const active = activeId === tool.id;
				return (
					<button
						key={tool.id}
						type="button"
						aria-pressed={active}
						onClick={() => app.store.setActiveToolId(tool.id)}
						style={{
							padding: "6px 12px",
							border: 0,
							borderRadius: 4,
							background: active ? "#8b5cf6" : "transparent",
							color: active ? "#fff" : "#cbd5e1",
							fontSize: 13,
							cursor: "pointer",
						}}
					>
						{tool.label}
					</button>
				);
			})}
		</div>
	);
}

function App() {
	const [app, setApp] = useState<AppInstance | null>(null);
	const [error, setError] = useState<Error | null>(null);

	useEffect(() => {
		let cancelled = false;
		let instance: AppInstance | null = null;
		const store = createBoardStore();

		createApp({
			store,
			plugins: [
				gridBgPlugin,
				basicShapePlugin,
				stickyPlugin,
				selectToolPlugin,
				panToolPlugin,
				viewportNavPlugin,
				createDomRendererPlugin(),
			],
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
					x: 160,
					y: 160,
					width: 200,
					height: 140,
					style: { ...DEFAULT_STYLE, fill: "#8b5cf6", stroke: "#a78bfa" },
				});
				store.addShape({
					id: "ellipse-1",
					type: "ellipse",
					x: 420,
					y: 180,
					width: 180,
					height: 140,
					style: { ...DEFAULT_STYLE, fill: "#22d3ee", stroke: "#67e8f9" },
				});
				const sticky: StickyShape = {
					id: "sticky-1",
					type: "sticky",
					x: 680,
					y: 160,
					width: 200,
					height: 200,
					style: { ...DEFAULT_STYLE, fill: "#fef08a", stroke: "transparent" },
					text: "Hello uSketch!",
					fontSize: 18,
					stickyColor: DEFAULT_STICKY_COLOR,
					isEditing: false,
				};
				store.addShape(sticky);

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
			<ToolSwitcher app={app} />
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
