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
import { calculateSnap } from "./engine/snap-engine.js";
import type { GuideStyle, SnapLine, SnapResult, SnapSettings } from "./engine/types.js";
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

function SnapGuideOverlay() {
	const state = useSyncExternalStore(subscribeState, getState, getState);
	if (state.lines.length === 0) return null;

	return (
		<svg
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				overflow: "visible",
				pointerEvents: "none",
			}}
		>
			<GuideLayer lines={state.lines} style={state.guideStyle} />
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

		// Frame-level cache for multi-shape snap consistency
		let frameSnapResult: SnapResult | null = null;
		let frameId = 0;

		// ── Pointer tracking ──

		const offPointerDown = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", () => {
			pointerDown = true;
			frameSnapResult = null;
		});

		const offPointerUp = ctx.events.on<CanvasPointerEvent>("canvas:pointerup", () => {
			pointerDown = false;
			frameSnapResult = null;
			setState({ lines: [] });
		});

		// ── Alt key tracking ──

		function onKeyDown(e: KeyboardEvent) {
			if (e.key === "Alt") altKeyHeld = true;
		}
		function onKeyUp(e: KeyboardEvent) {
			if (e.key === "Alt") altKeyHeld = false;
		}
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);

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

			// Get current frame ID to cache snap results across multi-shape updates
			const currentFrame = frameId;

			if (frameSnapResult && currentFrame === frameId) {
				const snapped = applySnapToUpdates(updates, frameSnapResult);
				originalUpdateShape(id, snapped);
				return;
			}

			const shape = ctx.store.getShape(id);
			if (!shape) {
				originalUpdateShape(id, updates);
				return;
			}

			const selection = ctx.store.getSelection();
			const movingIds = selection.size > 0 && selection.has(id) ? selection : new Set([id]);

			const movingBox = getMovingBoundingBox(ctx.store, movingIds, id, updates);

			const viewport = settings.viewportOnly ? ctx.store.getViewport() : null;
			const candidateBoxes = getCandidateBoxes(ctx.store, ctx, movingIds, viewport);

			const result = calculateSnap(movingBox, movingIds, candidateBoxes, settings);
			frameSnapResult = result;

			requestAnimationFrame(() => {
				if (frameId === currentFrame) {
					frameId++;
					frameSnapResult = null;
				}
			});

			const snapped = applySnapToUpdates(updates, result);
			originalUpdateShape(id, snapped);

			setState({ lines: result.lines });
		}

		ctx.store.updateShape = patchedUpdateShape;

		// ── Register overlay guide layer (above shapes) ──

		ctx.layers.register({
			id: "snap-guides",
			order: 90,
			render: () => <SnapGuideOverlay />,
		});

		// ── Teardown ──

		(this as UsketchPlugin).teardown = () => {
			offPointerDown();
			offPointerUp();
			offConfigure();
			offGetSettings();
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
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

function getMovingBoundingBox(
	store: BoardStore,
	movingIds: ReadonlySet<string>,
	currentId: string,
	currentUpdates: Partial<ShapeData>,
): BoundingBox {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const id of movingIds) {
		const shape = store.getShape(id);
		if (!shape) continue;

		const x = id === currentId && "x" in currentUpdates ? (currentUpdates.x as number) : shape.x;
		const y = id === currentId && "y" in currentUpdates ? (currentUpdates.y as number) : shape.y;
		const w =
			id === currentId && "width" in currentUpdates
				? (currentUpdates.width as number)
				: shape.width;
		const h =
			id === currentId && "height" in currentUpdates
				? (currentUpdates.height as number)
				: shape.height;

		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x + w);
		maxY = Math.max(maxY, y + h);
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
	const boxes = new Map<string, BoundingBox>();
	for (const [id, shape] of store.getShapes()) {
		if (movingIds.has(id)) continue;
		const def = ctx.shapes.get(shape.type);
		const box = def
			? def.getBounds(shape)
			: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
		if (visibleRect && !boxesOverlap(box, visibleRect)) continue;
		boxes.set(id, box);
	}
	return boxes;
}
