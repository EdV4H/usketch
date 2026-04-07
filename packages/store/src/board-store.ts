import type {
	BoardStore,
	BoundingBox,
	Point,
	ShapeData,
	ShapeStyle,
	StoreEvent,
	Viewport,
} from "@edv4h/usketch-shared";
import {
	compareZIndex,
	DEFAULT_STYLE,
	getRotatedAABB,
	safeRotation,
	zIndexAfterAll,
	zIndexBetween,
} from "@edv4h/usketch-shared";
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
	let sortedCache: readonly ShapeData[] | null = null;

	function invalidateSort() {
		sortedCache = null;
	}

	function shapeToBounds(shape: ShapeData): BoundingBox {
		const bounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
		const rotation = safeRotation(shape.rotation);
		if (rotation === 0) return bounds;
		return getRotatedAABB(bounds, rotation);
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

		getShapesSorted() {
			if (sortedCache) return sortedCache;
			sortedCache = [...state.shapes.values()].sort((a, b) => compareZIndex(a.zIndex, b.zIndex));
			return sortedCache;
		},

		getShape: (id) => state.shapes.get(id),

		addShape(shape: ShapeData) {
			const now = Date.now();
			const needsZIndex = typeof shape.zIndex !== "string";
			const zIndex = needsZIndex
				? zIndexAfterAll([...state.shapes.values()].map((s) => s.zIndex))
				: shape.zIndex;
			const stamped = {
				...shape,
				zIndex,
				_createdAt: (shape as Record<string, unknown>)._createdAt ?? now,
				_updatedAt: now,
			};
			state.shapes = new Map(state.shapes);
			state.shapes.set(stamped.id, stamped);
			spatialIndex.insert(stamped.id, shapeToBounds(stamped));
			invalidateSort();
			notify();
			notifyMutation("shape:added", { id: stamped.id });
		},

		updateShape(id: string, updates: Partial<ShapeData>) {
			const existing = state.shapes.get(id);
			if (!existing) return;
			state.shapes = new Map(state.shapes);
			const updated = { ...existing, ...updates, _updatedAt: Date.now() };
			state.shapes.set(id, updated);
			spatialIndex.update(id, shapeToBounds(updated));
			invalidateSort();
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
				invalidateSort();
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

		ensureZIndex() {
			// Assign zIndex to shapes that lack one, in current Map iteration order.
			// Chain zIndexBetween so each assigned key is strictly after the previous.
			const missing: ShapeData[] = [];
			let lastKey: string | null = null;
			for (const shape of state.shapes.values()) {
				if (typeof shape.zIndex === "string") {
					// Track the current max of existing keys
					if (lastKey === null || shape.zIndex > lastKey) lastKey = shape.zIndex;
				} else {
					missing.push(shape);
				}
			}
			if (missing.length === 0) return;

			const newMap = new Map(state.shapes);
			for (const shape of missing) {
				const newKey = zIndexBetween(lastKey, null);
				newMap.set(shape.id, { ...shape, zIndex: newKey });
				lastKey = newKey;
			}
			state.shapes = newMap;
			invalidateSort();
			notify();
			notifyMutation("shapes:z-index-initialized", { count: missing.length });
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
