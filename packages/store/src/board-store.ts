import type {
	BoardStore,
	BoundingBox,
	Point,
	ShapeData,
	ShapeStyle,
	StoreEvent,
	Viewport,
	ViewportAnimationConfig,
	ViewportAnimationOptions,
} from "@edv4h/usketch-shared";
import {
	compareZIndex,
	DEFAULT_STYLE,
	easeInOutCubic,
	getRotatedAABB,
	safeRotation,
	zIndexBetween,
} from "@edv4h/usketch-shared";
import { createSpatialIndex } from "./spatial-index.js";

export interface BoardState {
	shapes: Map<string, ShapeData>;
	selection: Set<string>;
	hoveredShapeId: string | null;
	activeToolId: string;
	defaultToolId: string;
	viewport: Viewport;
	styleSettings: ShapeStyle;
}

const INITIAL_DEFAULT_TOOL_ID = "select";

export interface BoardStoreOptions {
	/** Override the default smooth-viewport-animation behaviour (default: on). */
	viewportAnimation?: Partial<ViewportAnimationConfig>;
}

export function createBoardStore(options: BoardStoreOptions = {}): BoardStore {
	const state: BoardState = {
		shapes: new Map(),
		selection: new Set(),
		hoveredShapeId: null,
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

	// 完全な StoreEvent を受け取る。呼び出し側のオブジェクトリテラルが union に対して
	// 型検査されるため、type と payload の不整合（未知 type・誤った payload 形）は
	// コンパイル時に弾かれる。
	function notifyMutation(event: StoreEvent) {
		for (const listener of mutationListeners) {
			listener(event);
		}
	}

	// ── Viewport ─────────────────────────────────────────────────────────────
	let viewportAnimation: ViewportAnimationConfig = {
		enabled: options.viewportAnimation?.enabled ?? true,
		durationMs: options.viewportAnimation?.durationMs ?? 350,
		easing: options.viewportAnimation?.easing ?? easeInOutCubic,
	};
	let viewportRafId: number | null = null;

	function cancelViewportAnimation() {
		if (viewportRafId !== null && typeof cancelAnimationFrame !== "undefined") {
			cancelAnimationFrame(viewportRafId);
		}
		viewportRafId = null;
	}

	/** Assign the viewport and fan out the usual change notifications. */
	function commitViewport(viewport: Viewport) {
		state.viewport = viewport;
		notify();
		notifyMutation({ type: "viewport:changed" });
	}

	function prefersReducedMotion(): boolean {
		return (
			typeof window !== "undefined" &&
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches
		);
	}

	/** rAF tween to `target`, with instant fallback when animation can't/shouldn't run. */
	function animateViewportTo(target: Viewport, opts?: ViewportAnimationOptions) {
		cancelViewportAnimation();
		const duration = opts?.durationMs ?? viewportAnimation.durationMs;
		const animate = opts?.animate ?? viewportAnimation.enabled;
		const from = state.viewport;
		const near =
			Math.abs(from.x - target.x) < 0.01 &&
			Math.abs(from.y - target.y) < 0.01 &&
			Math.abs(from.zoom - target.zoom) < 1e-4;
		if (
			!animate ||
			near ||
			duration <= 0 ||
			typeof requestAnimationFrame === "undefined" ||
			typeof performance === "undefined" ||
			prefersReducedMotion()
		) {
			commitViewport(target);
			return;
		}
		const easing = opts?.easing ?? viewportAnimation.easing;
		const start = performance.now();
		const step = (now: number) => {
			const t = Math.min(1, (now - start) / duration);
			const k = easing(t);
			commitViewport({
				x: from.x + (target.x - from.x) * k,
				y: from.y + (target.y - from.y) * k,
				zoom: from.zoom + (target.zoom - from.zoom) * k,
			});
			if (t < 1) {
				viewportRafId = requestAnimationFrame(step);
			} else {
				viewportRafId = null;
			}
		};
		viewportRafId = requestAnimationFrame(step);
	}

	function setActiveToolId(id: string) {
		if (state.activeToolId === id) return;
		state.activeToolId = id;
		notify();
		notifyMutation({ type: "tool:changed", payload: { id } });
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
			notifyMutation({ type: "shape:added", payload: { id: stamped.id, ids: [stamped.id] } });
		},

		updateShape(id: string, updates: Partial<Omit<ShapeData, "id">>) {
			const existing = state.shapes.get(id);
			if (!existing) return;
			state.shapes = new Map(state.shapes);
			// Pin `id` to the Map key after spreading `updates`: a stray `id` in
			// `updates` would otherwise desync `updated.id` (and the `shape:updated`
			// payload's `after.id`) from the key we store under.
			const updated = { ...existing, ...updates, id, updatedAt: Date.now() };
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
			notifyMutation({
				type: "shape:updated",
				payload: { id, ids: [id], before: existing, after: updated },
			});
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
				notifyMutation({ type: "shape:removed", payload: { id, ids: [id] } });
			}
			if (wasSelected) {
				notifyMutation({ type: "selection:changed" });
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
			notifyMutation({ type: "shapes:z-index-initialized", payload: { count } });
		},

		getSelection: () => state.selection,

		setSelection(ids: string[]) {
			state.selection = new Set(ids);
			notify();
			notifyMutation({ type: "selection:changed", payload: { ids } });
		},

		addToSelection(id: string) {
			state.selection = new Set(state.selection);
			state.selection.add(id);
			notify();
			notifyMutation({ type: "selection:changed" });
		},

		removeFromSelection(id: string) {
			state.selection = new Set(state.selection);
			state.selection.delete(id);
			notify();
			notifyMutation({ type: "selection:changed" });
		},

		clearSelection() {
			if (state.selection.size === 0) return;
			state.selection = new Set();
			notify();
			notifyMutation({ type: "selection:changed" });
		},

		getHoveredShapeId: () => state.hoveredShapeId,

		setHoveredShapeId(id: string | null) {
			if (state.hoveredShapeId === id) return;
			state.hoveredShapeId = id;
			// Reuse the main subscribe channel: selector-based subscribers
			// (`useSyncExternalStore`) only re-render when their selected value
			// changes, so shape/selection consumers are unaffected by hover churn.
			notify();
		},

		getActiveToolId: () => state.activeToolId,

		setActiveToolId,

		getDefaultToolId: () => state.defaultToolId,

		setDefaultToolId(id: string) {
			if (state.defaultToolId === id) return;
			state.defaultToolId = id;
			notify();
			notifyMutation({ type: "default-tool:changed", payload: { id } });
		},

		resetToDefaultTool() {
			setActiveToolId(state.defaultToolId);
		},

		getViewport: () => state.viewport,

		// Instant setters cancel any in-flight animation so interaction wins.
		setViewport(viewport: Viewport) {
			cancelViewportAnimation();
			commitViewport(viewport);
		},

		panBy(dx: number, dy: number) {
			cancelViewportAnimation();
			commitViewport({
				...state.viewport,
				x: state.viewport.x + dx,
				y: state.viewport.y + dy,
			});
		},

		zoomTo(zoom: number, center: Point) {
			cancelViewportAnimation();
			const clampedZoom = Math.min(Math.max(zoom, 0.1), 10);
			const oldZoom = state.viewport.zoom;
			const scale = clampedZoom / oldZoom;
			commitViewport({
				x: center.x - (center.x - state.viewport.x) * scale,
				y: center.y - (center.y - state.viewport.y) * scale,
				zoom: clampedZoom,
			});
		},

		animateViewportTo,
		getViewportAnimation: () => ({ ...viewportAnimation }),
		setViewportAnimation(config: Partial<ViewportAnimationConfig>) {
			viewportAnimation = {
				enabled: config.enabled ?? viewportAnimation.enabled,
				durationMs: config.durationMs ?? viewportAnimation.durationMs,
				easing: config.easing ?? viewportAnimation.easing,
			};
		},

		fitToBounds(
			bounds: BoundingBox,
			viewportSize: { width: number; height: number },
			padding = 40,
			opts?: ViewportAnimationOptions,
		) {
			if (bounds.width <= 0 || bounds.height <= 0) return;
			if (viewportSize.width <= 0 || viewportSize.height <= 0) return;
			const availW = Math.max(1, viewportSize.width - padding * 2);
			const availH = Math.max(1, viewportSize.height - padding * 2);
			const rawZoom = Math.min(availW / bounds.width, availH / bounds.height);
			const zoom = Math.min(Math.max(rawZoom, 0.1), 10);
			const cx = bounds.x + bounds.width / 2;
			const cy = bounds.y + bounds.height / 2;
			// Programmatic fit → animate by default (see animateViewportTo fallbacks).
			animateViewportTo(
				{
					x: viewportSize.width / 2 - cx * zoom,
					y: viewportSize.height / 2 - cy * zoom,
					zoom,
				},
				opts,
			);
		},

		getStyleSettings: () => state.styleSettings,

		setStyleSettings(style: Partial<ShapeStyle>) {
			state.styleSettings = { ...state.styleSettings, ...style };
			notify();
			notifyMutation({ type: "style:changed" });
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
