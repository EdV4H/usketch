import type { Shape } from "@usketch/shared-types";
import { useWhiteboardStore } from "@usketch/store";
import { useMemo } from "react";
import type { CanvasManager } from "../types";

export const useCanvas = (): CanvasManager => {
	const store = useWhiteboardStore();

	return useMemo(
		() => ({
			addShape: (shape: Shape) => {
				store.addShape(shape);
			},

			updateShape: (id: string, updates: Partial<Shape>) => {
				store.updateShape(id, updates);
			},

			deleteShape: (id: string) => {
				store.deleteShapes([id]);
			},

			selectShapes: (ids: string[]) => {
				store.selectShapes(ids);
			},

			clearSelection: () => {
				store.clearSelection();
			},

			setTool: (tool: string) => {
				store.setCurrentTool(tool);
			},

			undo: () => {
				store.undo();
			},

			redo: () => {
				store.redo();
			},

			zoomIn: () => {
				const currentZoom = store.camera.zoom;
				store.setCamera({ zoom: Math.min(currentZoom * 1.2, 5) });
			},

			zoomOut: () => {
				const currentZoom = store.camera.zoom;
				store.setCamera({ zoom: Math.max(currentZoom / 1.2, 0.1) });
			},

			resetZoom: () => {
				store.setCamera({ zoom: 1, x: 0, y: 0 });
			},
		}),
		[store],
	);
};
