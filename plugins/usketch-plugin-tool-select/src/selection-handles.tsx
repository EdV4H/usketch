import type {
	BoardStore,
	Point,
	SelectionHandle,
	SelectionHandleProvider,
	SelectionHandleRegistry,
	SelectionHandleState,
	ShapeRegistry,
	Viewport,
} from "@edv4h/usketch-shared";
import {
	DEFAULT_SELECTION_HANDLE_HIT_RADIUS,
	screenToOverlay,
	unrotatedViewport,
	worldToScreen,
} from "@edv4h/usketch-shared";
import {
	findHandleAtScreenPoint,
	findMultiHandleAtScreenPoint,
	findMultiRotationHandleAtScreenPoint,
	findRotationHandleAtScreenPoint,
	getMultiSelectionBounds,
} from "@edv4h/usketch-tool-helpers";
import { Fragment, useCallback, useRef, useSyncExternalStore } from "react";
import type { OverlayColorStore } from "./overlay-colors.js";

/** Stable ids of the layers this plugin registers. */
export const SELECT_TOOL_LAYER_IDS = {
	/** Handles other plugins add through `ctx.ui.selectionHandles` (connector anchors / ends …). */
	handles: "usketch-plugin-tool-select:handles",
} as const;

/** The select tool's id (the handles exist only while it is active). */
const SELECT_TOOL_ID = "select";

interface HandleCtx {
	store: BoardStore;
	shapes: ShapeRegistry;
}

/** A provider's handle, identified for hover / drag state. */
export interface HandleHit {
	provider: SelectionHandleProvider;
	handle: SelectionHandle;
}

interface HandleRef {
	providerId: string;
	handleId: string;
}

export interface HandleInteraction {
	/** The handle under the pointer. */
	hovered: HandleRef | null;
	/** The handle being dragged. */
	dragging: HandleRef | null;
	/** The tool is moving / resizing / rotating shapes or drawing a marquee. */
	busy: boolean;
}

/** Per-instance hover / drag state of the handles, read by the overlay. */
export interface HandleInteractionStore {
	get(): HandleInteraction;
	set(patch: Partial<HandleInteraction>): void;
	subscribe(listener: () => void): () => void;
}

const sameRef = (a: HandleRef | null, b: HandleRef | null) =>
	a === b || (!!a && !!b && a.providerId === b.providerId && a.handleId === b.handleId);

export function createHandleInteractionStore(): HandleInteractionStore {
	let state: HandleInteraction = { hovered: null, dragging: null, busy: false };
	const listeners = new Set<() => void>();
	return {
		get: () => state,
		set(patch) {
			const next = { ...state, ...patch };
			if (
				sameRef(next.hovered, state.hovered) &&
				sameRef(next.dragging, state.dragging) &&
				next.busy === state.busy
			) {
				return;
			}
			state = next;
			for (const l of listeners) l();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

/** Screen position of a handle in the overlay frame (`viewport` = the unrotated viewport). */
export function handleToScreen(handle: SelectionHandle, viewport: Viewport): Point {
	const p = worldToScreen(handle.point.x, handle.point.y, viewport);
	return handle.offset ? { x: p.x + handle.offset.x, y: p.y + handle.offset.y } : p;
}

/**
 * A test for whether one of the select tool's own handles (rotation / resize,
 * single or multi-selection) is at a point. Everything is in the overlay frame,
 * so the helpers get the unrotated viewport (their overlay mapping is then
 * identity). The multi-selection bounds are computed once, not per handle.
 */
function builtInHandleTest(ctx: HandleCtx, viewport: Viewport): (point: Point) => boolean {
	const selection = ctx.store.getSelection();
	const bounds =
		selection.size > 1 ? getMultiSelectionBounds(ctx.store, ctx.shapes, selection) : null;
	return (point) =>
		!!findRotationHandleAtScreenPoint(point, ctx.shapes, ctx.store, viewport) ||
		!!findHandleAtScreenPoint(point, ctx.shapes, ctx.store, viewport) ||
		(!!bounds &&
			(!!findMultiRotationHandleAtScreenPoint(point, bounds, viewport) ||
				!!findMultiHandleAtScreenPoint(point, bounds, viewport)));
}

export function handleState(ctx: HandleCtx): SelectionHandleState {
	return {
		store: ctx.store,
		shapes: ctx.shapes,
		selection: ctx.store.getSelection(),
		hoveredShapeId: ctx.store.getHoveredShapeId(),
	};
}

/**
 * The handles shown now, per provider in hit-test order. A handle sitting on one
 * of the select tool's own handles is left out: the built-in handle wins the
 * press, so drawing the other one there would promise something it can't do.
 * Empty unless the select tool is active.
 */
export function collectHandles(
	registry: SelectionHandleRegistry,
	ctx: HandleCtx,
	viewport: Viewport,
): { provider: SelectionHandleProvider; handles: SelectionHandle[] }[] {
	if (ctx.store.getActiveToolId() !== SELECT_TOOL_ID) return [];
	const state = handleState(ctx);
	const onBuiltIn = builtInHandleTest(ctx, viewport);
	return registry.getAll().map((provider) => ({
		provider,
		handles: provider.getHandles(state).filter((h) => !onBuiltIn(handleToScreen(h, viewport))),
	}));
}

/**
 * The handle at a pointer (`screenPoint` in canvas coordinates, as on
 * `CanvasPointerEvent`): the highest-priority provider first, and within a
 * provider the handle drawn last (on top) first.
 */
export function findHandleAt(
	registry: SelectionHandleRegistry,
	ctx: HandleCtx,
	screenPoint: Point,
): HandleHit | null {
	const raw = ctx.store.getViewport();
	const viewport = unrotatedViewport(raw);
	const p = screenToOverlay(screenPoint.x, screenPoint.y, raw);
	for (const { provider, handles } of collectHandles(registry, ctx, viewport)) {
		for (let i = handles.length - 1; i >= 0; i--) {
			const handle = handles[i] as SelectionHandle;
			const s = handleToScreen(handle, viewport);
			const r = handle.hitRadius ?? DEFAULT_SELECTION_HANDLE_HIT_RADIUS;
			if (Math.hypot(p.x - s.x, p.y - s.y) <= r) return { provider, handle };
		}
	}
	return null;
}

/** Re-render on every store change (one listener; the providers may read anything). */
function useStoreVersion(store: BoardStore): number {
	const version = useRef(0);
	const subscribe = useCallback(
		(cb: () => void) =>
			store.subscribe(() => {
				version.current++;
				cb();
			}),
		[store],
	);
	const get = () => version.current;
	return useSyncExternalStore(subscribe, get, get);
}

interface SelectionHandlesOverlayProps extends HandleCtx {
	registry: SelectionHandleRegistry;
	interaction: HandleInteractionStore;
	colors: OverlayColorStore;
	/** The layer's viewport (unrotated under camera rotation: a world-overlay layer). */
	viewport: Viewport;
}

/**
 * Draws every provider's handles. Providers are drawn lowest priority first so
 * the one hit-tested first is on top. While the tool moves / resizes shapes or
 * draws a marquee nothing is shown; while a handle is dragged only its provider
 * draws (with `dragging`).
 */
export function SelectionHandlesOverlay({
	registry,
	interaction,
	colors,
	viewport,
	store,
	shapes,
}: SelectionHandlesOverlayProps) {
	useSyncExternalStore(registry.subscribe, registry.getAll, registry.getAll);
	const { hovered, dragging, busy } = useSyncExternalStore(
		interaction.subscribe,
		interaction.get,
		interaction.get,
	);
	const { strokeColor, handleFillColor } = useSyncExternalStore(
		colors.subscribe,
		colors.getSnapshot,
		colors.getSnapshot,
	);
	useStoreVersion(store);
	if (busy) return null;

	const ctx = { store, shapes };
	const groups = collectHandles(registry, ctx, viewport);
	if (groups.length === 0) return null;
	const state = handleState(ctx);
	const toScreen = (h: SelectionHandle) => handleToScreen(h, viewport);

	return (
		<>
			{[...groups].reverse().map(({ provider, handles }) => {
				const owns = dragging?.providerId === provider.id;
				if (dragging && !owns) return null;
				return (
					<Fragment key={provider.id}>
						{provider.render({
							...state,
							viewport,
							handles,
							hoveredHandleId: hovered?.providerId === provider.id ? hovered.handleId : null,
							dragging: owns,
							colors: { stroke: strokeColor, fill: handleFillColor },
							toScreen,
						})}
					</Fragment>
				);
			})}
		</>
	);
}
