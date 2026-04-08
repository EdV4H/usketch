import { AppProvider, Canvas } from "@edv4h/usketch-canvas-engine";
import { type AppInstance, createApp, createShapeCountLodPolicy } from "@edv4h/usketch-core";
import { createDomRendererPlugin } from "@edv4h/usketch-dom-renderer";
import { createGpuRendererPlugin } from "@edv4h/usketch-gpu-renderer";
import { basicShapePlugin } from "@edv4h/usketch-plugin-shape-basic";
import type { BoardStore, ShapeData, UsketchPlugin } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { useEffect, useRef, useState } from "react";

/**
 * "lod-off": LOD controller pinned to `interactive` — DOM renders every shape
 * with its full React component, GPU layer is OFF. This mirrors the legacy
 * uSketch behavior.
 *
 * "lod-on": LOD controller follows a shape-count policy. With many shapes the
 * controller flips to `lod`, GPU takes over rect/ellipse and DOM falls back to
 * simplified components.
 */
export type LodMode = "lod-off" | "lod-on";

interface BenchmarkCanvasProps {
	mode: LodMode;
	onReady: (store: BoardStore) => void;
	onDestroy?: () => void;
}

export function BenchmarkCanvas({ mode, onReady, onDestroy }: BenchmarkCanvasProps) {
	const [app, setApp] = useState<AppInstance | null>(null);
	const destroyRef = useRef(onDestroy);
	destroyRef.current = onDestroy;

	useEffect(() => {
		let cancelled = false;
		let instance: AppInstance | null = null;
		const store = createBoardStore();

		const plugins: UsketchPlugin[] = [
			basicShapePlugin,
			createGpuRendererPlugin(),
			createDomRendererPlugin(),
		];

		// Enter `lod` aggressively for the lod-on panel: any non-trivial shape
		// count triggers it. The lod-off panel pins the mode to `interactive`
		// after createApp resolves.
		const lodConfig =
			mode === "lod-on"
				? { policy: createShapeCountLodPolicy({ enterAt: 50, exitAt: 30 }) }
				: undefined;

		createApp({ store, plugins, lod: lodConfig }).then((created) => {
			if (cancelled) {
				created.destroy();
				return;
			}
			if (mode === "lod-off") {
				created.lod.setManualOverride("interactive");
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
	}, [mode, onReady]);

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
				Initializing {mode === "lod-on" ? "LOD on" : "LOD off"}...
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
