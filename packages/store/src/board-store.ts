import type { BoardStore, Point, ShapeData, ShapeStyle, Viewport } from "@usketch/shared";
import { DEFAULT_STYLE } from "@usketch/shared";

export interface BoardState {
	shapes: Map<string, ShapeData>;
	selection: Set<string>;
	activeToolId: string;
	viewport: Viewport;
	styleSettings: ShapeStyle;
}

export function createBoardStore(): BoardStore {
	const state: BoardState = {
		shapes: new Map(),
		selection: new Set(),
		activeToolId: "select",
		viewport: { x: 0, y: 0, zoom: 1 },
		styleSettings: { ...DEFAULT_STYLE },
	};

	const listeners = new Set<() => void>();

	function notify() {
		for (const listener of listeners) {
			listener();
		}
	}

	return {
		getShapes: () => state.shapes,
		getShape: (id) => state.shapes.get(id),

		addShape(shape: ShapeData) {
			state.shapes = new Map(state.shapes);
			state.shapes.set(shape.id, shape);
			notify();
		},

		updateShape(id: string, updates: Partial<ShapeData>) {
			const existing = state.shapes.get(id);
			if (!existing) return;
			state.shapes = new Map(state.shapes);
			state.shapes.set(id, { ...existing, ...updates });
			notify();
		},

		deleteShape(id: string) {
			state.shapes = new Map(state.shapes);
			state.shapes.delete(id);
			state.selection = new Set(state.selection);
			state.selection.delete(id);
			notify();
		},

		getSelection: () => state.selection,

		setSelection(ids: string[]) {
			state.selection = new Set(ids);
			notify();
		},

		addToSelection(id: string) {
			state.selection = new Set(state.selection);
			state.selection.add(id);
			notify();
		},

		removeFromSelection(id: string) {
			state.selection = new Set(state.selection);
			state.selection.delete(id);
			notify();
		},

		clearSelection() {
			if (state.selection.size === 0) return;
			state.selection = new Set();
			notify();
		},

		getActiveToolId: () => state.activeToolId,

		setActiveToolId(id: string) {
			if (state.activeToolId === id) return;
			state.activeToolId = id;
			notify();
		},

		getViewport: () => state.viewport,

		setViewport(viewport: Viewport) {
			state.viewport = viewport;
			notify();
		},

		panBy(dx: number, dy: number) {
			state.viewport = {
				...state.viewport,
				x: state.viewport.x + dx,
				y: state.viewport.y + dy,
			};
			notify();
		},

		zoomTo(zoom: number, center: Point) {
			const clampedZoom = Math.min(Math.max(zoom, 0.1), 10);
			const oldZoom = state.viewport.zoom;
			const scale = clampedZoom / oldZoom;
			state.viewport = {
				x: center.x - (center.x - state.viewport.x) * scale,
				y: center.y - (center.y - state.viewport.y) * scale,
				zoom: clampedZoom,
			};
			notify();
		},

		getStyleSettings: () => state.styleSettings,

		setStyleSettings(style: Partial<ShapeStyle>) {
			state.styleSettings = { ...state.styleSettings, ...style };
			notify();
		},

		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
