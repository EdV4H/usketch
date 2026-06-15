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
	zIndexBetween,
} from "@edv4h/usketch-shared";
import { createSpatialIndex } from "./spatial-index.js";

export interface BoardState {
	shapes: Map<string, ShapeData>;
	selection: Set<string>;
	activeToolId: string;
	defaultToolId: string;
	viewport: Viewport;
	styleSettings: ShapeStyle;
}

const INITIAL_DEFAULT_TOOL_ID = "select";

export function createBoardStore(): BoardStore {
	const state: BoardState = {
		shapes: new Map(),
		selection: new Set(),
		activeToolId: INITIAL_DEFAULT_TOOL_ID,
		defaultToolId: INITIAL_DEFAULT_TOOL_ID,
		viewport: { x: 0, y: 0, zoom: 1 },
		styleSettings: { ...DEFAULT_STYLE },
	};

	const spatialIndex = createSpatialIndex();
	const listeners = new Set<() => void>();
	const mutationListeners = new Set<(event: StoreEvent) => void>();
	let sortedCache: readonly ShapeData[] | null = null;
	// Incremental max-zIndex tracking: updated on add/update/delete so that
	// `addShape` can append a new tail key in O(1) without rescanning all shapes.
	// `null` means we need to recompute (e.g. after deletion of the current max).
	let maxZIndex: string | null = null;

	function invalidateSort() {
		sortedCache = null;
	}

	function recomputeMaxZIndex(): void {
		let max: string | null = null;
		for (const shape of state.shapes.values()) {
			if (typeof shape.zIndex === "string" && (max === null || shape.zIndex > max)) {
				max = shape.zIndex;
			}
		}
		maxZIndex = max;
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

	function setActiveToolId(id: string) {
		if (state.activeToolId === id) return;
		state.activeToolId = id;
		notify();
		notifyMutation("tool:changed", { id });
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
			// Fast path: use the tracked max-zIndex to append a tail key in O(1)
			// rather than rescanning all existing shapes on every insert.
			const zIndex = needsZIndex ? zIndexBetween(maxZIndex, null) : shape.zIndex;
			const stamped: ShapeData = {
				...shape,
				zIndex,
				createdAt: shape.createdAt ?? now,
				updatedAt: now,
			};
			state.shapes = new Map(state.shapes);
			state.shapes.set(stamped.id, stamped);
			spatialIndex.insert(stamped.id, shapeToBounds(stamped));
			// Update tracked max if this new key is greater
			if (typeof zIndex === "string" && (maxZIndex === null || zIndex > maxZIndex)) {
				maxZIndex = zIndex;
			}
			invalidateSort();
			notify();
			notifyMutation("shape:added", { id: stamped.id, ids: [stamped.id] });
		},

		updateShape(id: string, updates: Partial<ShapeData>) {
			const existing = state.shapes.get(id);
			if (!existing) return;
			state.shapes = new Map(state.shapes);
			const updated = { ...existing, ...updates, updatedAt: Date.now() };
			state.shapes.set(id, updated);
			spatialIndex.update(id, shapeToBounds(updated));
			// If zIndex was touched, the cached max may be stale. Recompute lazily
			// only when the changed key could be (or was) the current max.
			if ("zIndex" in updates) {
				const oldZ = existing.zIndex;
				const newZ = updated.zIndex;
				if (
					oldZ === maxZIndex ||
					(typeof newZ === "string" && (maxZIndex === null || newZ > maxZIndex))
				) {
					recomputeMaxZIndex();
				}
			}
			invalidateSort();
			notify();
			// before/after を載せて、追従系が自前で前回位置を持たなくても差分を取れるように。
			notifyMutation("shape:updated", { id, ids: [id], before: existing, after: updated });
		},

		deleteShape(id: string) {
			const existed = state.shapes.has(id);
			const wasSelected = state.selection.has(id);
			if (!existed && !wasSelected) return;
			if (existed) {
				const removed = state.shapes.get(id);
				state.shapes = new Map(state.shapes);
				state.shapes.delete(id);
				spatialIndex.remove(id);
				// If we just deleted the shape holding the tracked max, recompute
				if (removed && removed.zIndex === maxZIndex) {
					recomputeMaxZIndex();
				}
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
				notifyMutation("shape:removed", { id, ids: [id] });
			}
			if (wasSelected) {
				notifyMutation("selection:changed");
			}
		},

		ensureZIndex() {
			// Assign zIndex to shapes that are missing one, appending them after the
			// current maximum existing key. Missing shapes are processed in their Map
			// iteration order, so their relative order (between themselves) is preserved.
			//
			// Note: this does NOT reindex shapes that already have a zIndex — it only
			// backfills missing keys. Mixed stores therefore keep their existing keys
			// intact and the newly-assigned shapes land above the highest known key.
			let tailKey: string | null = null;
			for (const shape of state.shapes.values()) {
				if (typeof shape.zIndex === "string" && (tailKey === null || shape.zIndex > tailKey)) {
					tailKey = shape.zIndex;
				}
			}

			let count = 0;
			let newMap: Map<string, ShapeData> | null = null;
			for (const [id, shape] of state.shapes) {
				if (typeof shape.zIndex === "string") continue;
				if (!newMap) newMap = new Map(state.shapes);
				const newKey = zIndexBetween(tailKey, null);
				newMap.set(id, { ...shape, zIndex: newKey });
				tailKey = newKey;
				count++;
			}
			if (!newMap) return;

			state.shapes = newMap;
			maxZIndex = tailKey;
			invalidateSort();
			notify();
			notifyMutation("shapes:z-index-initialized", { count });
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

		setActiveToolId,

		getDefaultToolId: () => state.defaultToolId,

		setDefaultToolId(id: string) {
			if (state.defaultToolId === id) return;
			state.defaultToolId = id;
			notify();
			notifyMutation("default-tool:changed", { id });
		},

		resetToDefaultTool() {
			setActiveToolId(state.defaultToolId);
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

		fitToBounds(
			bounds: BoundingBox,
			viewportSize: { width: number; height: number },
			padding = 40,
		) {
			if (bounds.width <= 0 || bounds.height <= 0) return;
			if (viewportSize.width <= 0 || viewportSize.height <= 0) return;
			const availW = Math.max(1, viewportSize.width - padding * 2);
			const availH = Math.max(1, viewportSize.height - padding * 2);
			const rawZoom = Math.min(availW / bounds.width, availH / bounds.height);
			const zoom = Math.min(Math.max(rawZoom, 0.1), 10);
			const cx = bounds.x + bounds.width / 2;
			const cy = bounds.y + bounds.height / 2;
			state.viewport = {
				x: viewportSize.width / 2 - cx * zoom,
				y: viewportSize.height / 2 - cy * zoom,
				zoom,
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
