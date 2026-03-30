import { AppProvider, Canvas } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp } from "@edv4h/usketch-core";
import { createDomRendererPlugin } from "@edv4h/usketch-dom-renderer";
import { createGpuRendererPlugin } from "@edv4h/usketch-gpu-renderer";
import { basicShapePlugin } from "@edv4h/usketch-plugin-shape-basic";
import type { BoardStore, ShapeData, UsketchPlugin } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { useEffect, useRef, useState } from "react";

export type RendererType = "dom" | "gpu";

interface BenchmarkCanvasProps {
	rendererType: RendererType;
	onReady: (store: BoardStore) => void;
	onDestroy?: () => void;
}

export function BenchmarkCanvas({ rendererType, onReady, onDestroy }: BenchmarkCanvasProps) {
	const [app, setApp] = useState<AppInstance | null>(null);
	const destroyRef = useRef(onDestroy);
	destroyRef.current = onDestroy;

	useEffect(() => {
		let cancelled = false;
		let instance: AppInstance | null = null;
		const store = createBoardStore();

		const plugins: UsketchPlugin[] = [basicShapePlugin];
		if (rendererType === "gpu") {
			plugins.push(createGpuRendererPlugin());
		}
		plugins.push(createDomRendererPlugin());

		createApp({ store, plugins }).then((created) => {
			if (cancelled) {
				created.destroy();
				return;
			}
			instance = created;
			setApp(instance);
			onReady(store);
		});

		return () => {
			cancelled = true;
			instance?.destroy();
			destroyRef.current?.();
			setApp(null);
		};
	}, [rendererType, onReady]);

	if (!app) {
		return (
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					color: "#888",
					fontFamily: "system-ui, sans-serif",
					fontSize: 14,
				}}
			>
				Initializing {rendererType.toUpperCase()}...
			</div>
		);
	}

	return (
		<AppProvider app={app}>
			<Canvas />
		</AppProvider>
	);
}

export function loadShapes(store: BoardStore, shapes: ShapeData[]): void {
	for (const shape of shapes) {
		store.addShape(shape);
	}
}

export function clearShapes(store: BoardStore): void {
	const ids = [...store.getShapes().keys()];
	for (const id of ids) {
		store.deleteShape(id);
	}
}
