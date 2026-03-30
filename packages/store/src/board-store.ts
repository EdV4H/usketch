import type {
	BoardStore,
	BoundingBox,
	Point,
	ShapeData,
	ShapeStyle,
	StoreEvent,
	Viewport,
} from "@edv4h/usketch-shared";
import { DEFAULT_STYLE } from "@edv4h/usketch-shared";
import { createSpatialIndex } from "./spatial-index.js";

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

	const spatialIndex = createSpatialIndex();
	const listeners = new Set<() => void>();
	const mutationListeners = new Set<(event: StoreEvent) => void>();

	function shapeToBounds(shape: ShapeData): BoundingBox {
		return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
	}

	function notify() {
		for (const listener of listeners) {
			listener();
		}
	}

	function notifyMutation(type: string, payload?: unknown) {
		const event: StoreEvent = payload !== undefined ? { type, payload } : { type };
		for (const listener of mutationListeners) {
			listener(event);
		}
	}

	return {
		getShapes: () => state.shapes,
		getShape: (id) => state.shapes.get(id),

		addShape(shape: ShapeData) {
			state.shapes = new Map(state.shapes);
			state.shapes.set(shape.id, shape);
			spatialIndex.insert(shape.id, shapeToBounds(shape));
			notify();
			notifyMutation("shape:added", { id: shape.id });
		},

		updateShape(id: string, updates: Partial<ShapeData>) {
			const existing = state.shapes.get(id);
			if (!existing) return;
			state.shapes = new Map(state.shapes);
			const updated = { ...existing, ...updates };
			state.shapes.set(id, updated);
			spatialIndex.update(id, shapeToBounds(updated));
			notify();
			notifyMutation("shape:updated", { id });
		},

		deleteShape(id: string) {
			const existed = state.shapes.has(id);
			const wasSelected = state.selection.has(id);
			if (!existed && !wasSelected) return;
			if (existed) {
				state.shapes = new Map(state.shapes);
				state.shapes.delete(id);
				spatialIndex.remove(id);
			}
			if (wasSelected) {
				state.selection = new Set(state.selection);
				state.selection.delete(id);
			}
			if (existed || wasSelected) {
				notify();
			}
			if (existed) {
				notifyMutation("shape:removed", { id });
			}
			if (wasSelected) {
				notifyMutation("selection:changed");
			}
		},

		getSelection: () => state.selection,

		setSelection(ids: string[]) {
			state.selection = new Set(ids);
			notify();
			notifyMutation("selection:changed", { ids });
		},

		addToSelection(id: string) {
			state.selection = new Set(state.selection);
			state.selection.add(id);
			notify();
			notifyMutation("selection:changed");
		},

		removeFromSelection(id: string) {
			state.selection = new Set(state.selection);
			state.selection.delete(id);
			notify();
			notifyMutation("selection:changed");
		},

		clearSelection() {
			if (state.selection.size === 0) return;
			state.selection = new Set();
			notify();
			notifyMutation("selection:changed");
		},

		getActiveToolId: () => state.activeToolId,

		setActiveToolId(id: string) {
			if (state.activeToolId === id) return;
			state.activeToolId = id;
			notify();
			notifyMutation("tool:changed", { id });
		},

		getViewport: () => state.viewport,

		setViewport(viewport: Viewport) {
			state.viewport = viewport;
			notify();
			notifyMutation("viewport:changed");
		},

		panBy(dx: number, dy: number) {
			state.viewport = {
				...state.viewport,
				x: state.viewport.x + dx,
				y: state.viewport.y + dy,
			};
			notify();
			notifyMutation("viewport:changed");
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
			notifyMutation("viewport:changed");
		},

		getStyleSettings: () => state.styleSettings,

		setStyleSettings(style: Partial<ShapeStyle>) {
			state.styleSettings = { ...state.styleSettings, ...style };
			notify();
			notifyMutation("style:changed");
		},

		getVisibleShapeIds(viewportBounds: BoundingBox): string[] {
			return spatialIndex.query(viewportBounds);
		},

		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},

		onMutation(listener: (event: StoreEvent) => void): () => void {
			mutationListeners.add(listener);
			return () => {
				mutationListeners.delete(listener);
			};
		},
	};
}
