import type {
	BoardStore,
	BoundingBox,
	CanvasPointerEvent,
	PluginContext,
	ShapeData,
	UsketchPlugin,
	Viewport,
} from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import { DEFAULT_GUIDE_STYLE, DEFAULT_SNAP_THRESHOLD } from "./constants.js";
import { calculateSnap, type SnapEdgeFilter } from "./engine/snap-engine.js";
import type { GuideStyle, SnapEdge, SnapLine, SnapResult, SnapSettings } from "./engine/types.js";
import { GuideLayer } from "./guide-layer.js";

// ── Shared mutable state for the plugin ──

interface SnapGuideState {
	lines: SnapLine[];
	guideStyle: GuideStyle;
}

let currentState: SnapGuideState = { lines: [], guideStyle: { ...DEFAULT_GUIDE_STYLE } };
const stateListeners: Set<() => void> = new Set();

function setState(patch: Partial<SnapGuideState>) {
	currentState = { ...currentState, ...patch };
	for (const fn of stateListeners) fn();
}

function subscribeState(cb: () => void): () => void {
	stateListeners.add(cb);
	return () => stateListeners.delete(cb);
}

function getState(): SnapGuideState {
	return currentState;
}

// ── Guide layer wrapper that subscribes to snap state updates ──

interface SnapGuideOverlayProps {
	viewport: { x: number; y: number; zoom: number };
}

function worldToScreen(wx: number, wy: number, vp: { x: number; y: number; zoom: number }) {
	return { x: wx * vp.zoom + vp.x, y: wy * vp.zoom + vp.y };
}

function toScreenLines(lines: SnapLine[], vp: { x: number; y: number; zoom: number }): SnapLine[] {
	return lines.map((line) => {
		const indicators = line.indicators.map((ind) => {
			const s = worldToScreen(ind.x, ind.y, vp);
			return { ...ind, x: s.x, y: s.y };
		});
		if (line.axis === "x") {
			const pos = worldToScreen(line.position, 0, vp).x;
			const from = worldToScreen(0, line.from, vp).y;
			const to = worldToScreen(0, line.to, vp).y;
			return { ...line, position: pos, from, to, indicators };
		}
		const pos = worldToScreen(0, line.position, vp).y;
		const from = worldToScreen(line.from, 0, vp).x;
		const to = worldToScreen(line.to, 0, vp).x;
		return { ...line, position: pos, from, to, indicators };
	});
}

function SnapGuideOverlay({ viewport }: SnapGuideOverlayProps) {
	const state = useSyncExternalStore(subscribeState, getState, getState);
	if (state.lines.length === 0) return null;

	const screenLines = toScreenLines(state.lines, viewport);

	return (
		<svg
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				width: "100%",
				height: "100%",
				overflow: "visible",
				pointerEvents: "none",
			}}
		>
			<GuideLayer lines={screenLines} style={state.guideStyle} />
		</svg>
	);
}

// ── Plugin ──

export const snapPlugin: UsketchPlugin = {
	id: "usketch-plugin-snap",
	name: "スナップ",

	setup(ctx: PluginContext) {
		const settings: SnapSettings = {
			enabled: true,
			threshold: DEFAULT_SNAP_THRESHOLD,
			edgeSnap: true,
			centerSnap: true,
			viewportOnly: true,
			guideStyle: { ...DEFAULT_GUIDE_STYLE },
		};

		// Sync initial guide style to shared state
		setState({ guideStyle: settings.guideStyle });

		let pointerDown = false;
		let altKeyHeld = false;

		// Frame-level caches for multi-shape snap consistency
		let frameSnapResult: SnapResult | null = null;
		let frameCandidateBoxes: Map<string, BoundingBox> | null = null;
		let frameId = 0;

		// ── Pointer tracking ──

		const offPointerDown = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", () => {
			pointerDown = true;
			frameSnapResult = null;
			frameCandidateBoxes = null;
			setState({ lines: [] });
		});

		const offPointerUp = ctx.events.on<CanvasPointerEvent>("canvas:pointerup", () => {
			pointerDown = false;
			frameSnapResult = null;
			frameCandidateBoxes = null;
			setState({ lines: [] });
		});

		// ── Alt key tracking ──

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Alt") altKeyHeld = true;
		}
		function onKeyUp(e: KeyboardEvent) {
			if (e.key === "Alt") altKeyHeld = false;
		}
		function onBlur() {
			altKeyHeld = false;
		}
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("blur", onBlur);

		// ── Settings API via EventBus ──

		const offConfigure = ctx.events.on<Partial<SnapSettings>>("snap:configure", (patch) => {
			if (patch.guideStyle) {
				settings.guideStyle = { ...settings.guideStyle, ...patch.guideStyle };
				setState({ guideStyle: settings.guideStyle });
			}
			const { guideStyle: _gs, ...rest } = patch;
			Object.assign(settings, rest);
		});

		const offGetSettings = ctx.events.on<(s: SnapSettings) => void>("snap:get-settings", (cb) => {
			cb({ ...settings, guideStyle: { ...settings.guideStyle } });
		});

		// ── Monkey-patch store.updateShape ──

		const originalUpdateShape = ctx.store.updateShape.bind(ctx.store);

		function patchedUpdateShape(id: string, updates: Partial<ShapeData>) {
			// Only snap during pointer-down, when enabled, and Alt not held
			const shouldSnap =
				pointerDown && settings.enabled && !altKeyHeld && hasPositionUpdate(updates);

			if (!shouldSnap) {
				originalUpdateShape(id, updates);
				if (pointerDown && altKeyHeld) {
					setState({ lines: [] });
				}
				return;
			}

			const shape = ctx.store.getShape(id);
			if (!shape) {
				originalUpdateShape(id, updates);
				return;
			}

			// Skip snap for connectors — they have their own anchor/snap logic
			if (shape.type === "connector") {
				originalUpdateShape(id, updates);
				setState({ lines: [] });
				return;
			}

			// Skip snap for child shapes whose parent is being dragged (in selection).
			// Children follow their parent's snap offset; snapping them individually
			// causes jitter because each child gets its own snap delta.
			const parentId = shape.parentId as string | undefined;
			if (parentId) {
				const sel = ctx.store.getSelection();
				if (sel.has(parentId)) {
					originalUpdateShape(id, updates);
					return;
				}
			}

			const isResize = isResizeUpdate(updates);

			// Get current frame ID to cache snap results across multi-shape updates
			const currentFrame = frameId;

			// Build movingBox early so it can be used in both cached and fresh paths
			const selection = ctx.store.getSelection();
			const movingIds = selection.size > 0 && selection.has(id) ? selection : new Set([id]);

			const movingBox = isResize
				? getResizedBoundingBox(shape, updates)
				: getMovingBoundingBox(
						ctx.store,
						movingIds,
						"x" in updates && typeof updates.x === "number" ? updates.x - shape.x : 0,
						"y" in updates && typeof updates.y === "number" ? updates.y - shape.y : 0,
					);

			if (frameSnapResult && currentFrame === frameId) {
				const snapped = isResize
					? applySnapToResize(updates, frameSnapResult, shape, movingBox)
					: applySnapToUpdates(updates, frameSnapResult);
				originalUpdateShape(id, snapped);
				return;
			}

			const candidateBoxes =
				frameCandidateBoxes ??
				getCandidateBoxes(
					ctx.store,
					ctx,
					movingIds,
					settings.viewportOnly ? ctx.store.getViewport() : null,
				);
			frameCandidateBoxes = candidateBoxes;

			const movingOverrides = isResize
				? { edgeSnap: settings.edgeSnap, centerSnap: false as const }
				: undefined;
			const edgeFilter = isResize ? getResizeEdgeFilter(shape, movingBox) : undefined;
			const result = calculateSnap(
				movingBox,
				movingIds,
				candidateBoxes,
				settings,
				movingOverrides,
				edgeFilter,
			);
			frameSnapResult = result;

			queueMicrotask(() => {
				if (frameId === currentFrame) {
					frameId++;
					frameSnapResult = null;
					frameCandidateBoxes = null;
				}
			});

			const snapped = isResize
				? applySnapToResize(updates, result, shape, movingBox)
				: applySnapToUpdates(updates, result);
			originalUpdateShape(id, snapped);

			setState({ lines: result.lines });
		}

		ctx.store.updateShape = patchedUpdateShape;

		// ── Register overlay guide layer (above shapes) ──

		ctx.layers.register({
			id: "snap-guides",
			order: 90,
			fixed: true,
			render: (renderCtx) => <SnapGuideOverlay viewport={renderCtx.viewport} />,
		});

		// ── Teardown ──

		(this as UsketchPlugin).teardown = () => {
			offPointerDown();
			offPointerUp();
			offConfigure();
			offGetSettings();
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", onBlur);
			ctx.store.updateShape = originalUpdateShape;
			ctx.layers.unregister("snap-guides");
			setState({ lines: [], guideStyle: { ...DEFAULT_GUIDE_STYLE } });
			stateListeners.clear();
		};
	},
};

// ── Helpers ──

function hasPositionUpdate(updates: Partial<ShapeData>): boolean {
	return "x" in updates || "y" in updates || "width" in updates || "height" in updates;
}

/** Resize updates contain width or height changes */
function isResizeUpdate(updates: Partial<ShapeData>): boolean {
	return "width" in updates || "height" in updates;
}

function applySnapToUpdates(updates: Partial<ShapeData>, result: SnapResult): Partial<ShapeData> {
	if (result.dx === 0 && result.dy === 0) return updates;

	const snapped = { ...updates };
	if ("x" in snapped && typeof snapped.x === "number") {
		snapped.x = snapped.x + result.dx;
	}
	if ("y" in snapped && typeof snapped.y === "number") {
		snapped.y = snapped.y + result.dy;
	}
	return snapped;
}

/**
 * Apply snap delta correctly for resize operations.
 *
 * Uses the xEdge/yEdge from the snap result to know which edge was matched,
 * and adjusts position + size accordingly:
 * - min edge matched: shift x/y by dx/dy, compensate width/height inversely
 * - max edge matched: only adjust width/height by dx/dy
 */
function applySnapToResize(
	updates: Partial<ShapeData>,
	result: SnapResult,
	shape: ShapeData,
	movingBox: BoundingBox,
): Partial<ShapeData> {
	if (result.dx === 0 && result.dy === 0) return updates;

	const snapped = { ...updates };
	const s = snapped as Record<string, unknown>;

	// Determine which edges are moving by comparing movingBox to current store shape
	const leftMoved = Math.abs(movingBox.x - shape.x) > 0.001;
	const rightMoved = Math.abs(movingBox.x + movingBox.width - (shape.x + shape.width)) > 0.001;

	if (result.dx !== 0 && result.xEdge === "min" && leftMoved) {
		// Left edge snapped: shift x, compensate width
		if (typeof snapped.x === "number") s.x = snapped.x + result.dx;
		if (typeof snapped.width === "number") s.width = (snapped.width as number) - result.dx;
	} else if (result.dx !== 0 && result.xEdge === "max" && rightMoved) {
		// Right edge snapped: adjust width only
		if (typeof snapped.width === "number") s.width = (snapped.width as number) + result.dx;
	}

	const topMoved = Math.abs(movingBox.y - shape.y) > 0.001;
	const bottomMoved = Math.abs(movingBox.y + movingBox.height - (shape.y + shape.height)) > 0.001;

	if (result.dy !== 0 && result.yEdge === "min" && topMoved) {
		// Top edge snapped: shift y, compensate height
		if (typeof snapped.y === "number") s.y = snapped.y + result.dy;
		if (typeof snapped.height === "number") s.height = (snapped.height as number) - result.dy;
	} else if (result.dy !== 0 && result.yEdge === "max" && bottomMoved) {
		// Bottom edge snapped: adjust height only
		if (typeof snapped.height === "number") s.height = (snapped.height as number) + result.dy;
	}

	return snapped;
}

/**
 * Determine which edges are being dragged during resize by comparing
 * the updated bounding box to the current store shape.
 *
 * This is more reliable than inferring from update keys, because multi-resize
 * always sends all 4 properties even when only some edges move.
 */
function getResizeEdgeFilter(shape: ShapeData, movingBox: BoundingBox): SnapEdgeFilter {
	const xEdges: SnapEdge[] = [];
	const yEdges: SnapEdge[] = [];

	const leftMoved = Math.abs(movingBox.x - shape.x) > 0.001;
	const rightMoved = Math.abs(movingBox.x + movingBox.width - (shape.x + shape.width)) > 0.001;
	const topMoved = Math.abs(movingBox.y - shape.y) > 0.001;
	const bottomMoved = Math.abs(movingBox.y + movingBox.height - (shape.y + shape.height)) > 0.001;

	if (leftMoved) xEdges.push("min");
	if (rightMoved) xEdges.push("max");
	if (topMoved) yEdges.push("min");
	if (bottomMoved) yEdges.push("max");

	return {
		xEdges: xEdges.length > 0 ? xEdges : undefined,
		yEdges: yEdges.length > 0 ? yEdges : undefined,
	};
}

/** Build the bounding box after applying resize updates to a shape */
function getResizedBoundingBox(shape: ShapeData, updates: Partial<ShapeData>): BoundingBox {
	const x = "x" in updates && typeof updates.x === "number" ? updates.x : shape.x;
	const y = "y" in updates && typeof updates.y === "number" ? updates.y : shape.y;
	const w = "width" in updates && typeof updates.width === "number" ? updates.width : shape.width;
	const h =
		"height" in updates && typeof updates.height === "number" ? updates.height : shape.height;
	return { x, y, width: w, height: h };
}

function getMovingBoundingBox(
	store: BoardStore,
	movingIds: ReadonlySet<string>,
	dx: number,
	dy: number,
): BoundingBox {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const id of movingIds) {
		const shape = store.getShape(id);
		if (!shape) continue;

		const x = shape.x + dx;
		const y = shape.y + dy;

		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x + shape.width);
		maxY = Math.max(maxY, y + shape.height);
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

function getVisibleWorldRect(viewport: Viewport): BoundingBox {
	const w = window.innerWidth;
	const h = window.innerHeight;
	return {
		x: -viewport.x / viewport.zoom,
		y: -viewport.y / viewport.zoom,
		width: w / viewport.zoom,
		height: h / viewport.zoom,
	};
}

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function getCandidateBoxes(
	store: BoardStore,
	ctx: PluginContext,
	movingIds: ReadonlySet<string>,
	viewport: Viewport | null,
): Map<string, BoundingBox> {
	const visibleRect = viewport ? getVisibleWorldRect(viewport) : null;

	// Determine the parent context of moving shapes.
	// All moving shapes should share the same parent (or all be top-level).
	let movingParentId: string | null | undefined;
	for (const id of movingIds) {
		const s = store.getShape(id);
		if (!s) continue;
		const pid = (s.parentId as string | undefined) ?? null;
		if (movingParentId === undefined) {
			movingParentId = pid;
		} else if (movingParentId !== pid) {
			// Mixed parents — skip frame-based filtering
			movingParentId = undefined;
			break;
		}
	}

	const boxes = new Map<string, BoundingBox>();
	for (const [id, shape] of store.getShapes()) {
		if (movingIds.has(id)) continue;
		// Connectors are never snap targets
		if (shape.type === "connector") continue;
		// Exclude children of moving shapes so a frame doesn't snap to its own children
		const parentId = (shape.parentId as string | undefined) ?? null;
		if (parentId && movingIds.has(parentId)) continue;

		// Only snap within the same frame context:
		// - If moving shapes are inside a frame, only snap to siblings in the same frame
		//   (also allow snapping to the parent frame itself)
		// - If moving shapes are top-level, don't snap to shapes inside frames
		if (movingParentId !== undefined) {
			if (parentId !== movingParentId && id !== movingParentId) continue;
		}

		const def = ctx.shapes.get(shape.type);
		const box = def
			? def.getBounds(shape)
			: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
		if (visibleRect && !boxesOverlap(box, visibleRect)) continue;
		boxes.set(id, box);
	}
	return boxes;
}
