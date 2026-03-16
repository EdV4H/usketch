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
import { DEFAULT_SNAP_THRESHOLD } from "./constants.js";
import { calculateSnap } from "./engine/snap-engine.js";
import type { SnapLine, SnapResult, SnapSettings } from "./engine/types.js";
import { GuideLayer } from "./guide-layer.js";

// ── Shared mutable state for the plugin ──

let currentLines: SnapLine[] = [];
const lineListeners: Set<() => void> = new Set();

function setLines(lines: SnapLine[]) {
	currentLines = lines;
	for (const fn of lineListeners) fn();
}

function subscribeLines(cb: () => void): () => void {
	lineListeners.add(cb);
	return () => lineListeners.delete(cb);
}

function getLines(): SnapLine[] {
	return currentLines;
}

// ── Guide layer wrapper that subscribes to snap line updates ──

function SnapGuideOverlay(_props: { viewport: { x: number; y: number; zoom: number } }) {
	const lines = useSyncExternalStore(subscribeLines, getLines, getLines);
	if (lines.length === 0) return null;

	// HTML overlay layer already has viewport CSS transform applied,
	// so SVG content is in world coordinates directly.
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
			<GuideLayer lines={lines} />
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
		};

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
			setLines([]);
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
			Object.assign(settings, patch);
		});

		const offGetSettings = ctx.events.on<(s: SnapSettings) => void>("snap:get-settings", (cb) => {
			cb({ ...settings });
		});

		// ── Monkey-patch store.updateShape ──

		const originalUpdateShape = ctx.store.updateShape.bind(ctx.store);

		function patchedUpdateShape(id: string, updates: Partial<ShapeData>) {
			// Only snap during pointer-down, when enabled, and Alt not held
			const shouldSnap =
				pointerDown && settings.enabled && !altKeyHeld && hasPositionUpdate(updates);

			if (!shouldSnap) {
				originalUpdateShape(id, updates);
				// Clear guides if pointer is down but alt is held
				if (pointerDown && altKeyHeld) {
					setLines([]);
				}
				return;
			}

			// Get current frame ID to cache snap results across multi-shape updates
			const currentFrame = frameId;

			if (frameSnapResult && currentFrame === frameId) {
				// Reuse cached snap result for subsequent shapes in the same frame
				const snapped = applySnapToUpdates(updates, frameSnapResult);
				originalUpdateShape(id, snapped);
				return;
			}

			// First shape in this frame — compute snap
			// Apply the updates temporarily to get the resulting bounding box
			const shape = ctx.store.getShape(id);
			if (!shape) {
				originalUpdateShape(id, updates);
				return;
			}

			const selection = ctx.store.getSelection();
			const movingIds = selection.size > 0 && selection.has(id) ? selection : new Set([id]);

			// Build the combined bounding box of all moving shapes (with updates applied)
			const movingBox = getMovingBoundingBox(ctx.store, movingIds, id, updates);

			// Build candidate boxes (non-moving shapes, optionally viewport-filtered)
			const viewport = settings.viewportOnly ? ctx.store.getViewport() : null;
			const candidateBoxes = getCandidateBoxes(ctx.store, ctx, movingIds, viewport);

			const result = calculateSnap(movingBox, movingIds, candidateBoxes, settings);
			frameSnapResult = result;

			// Schedule frame reset
			requestAnimationFrame(() => {
				if (frameId === currentFrame) {
					frameId++;
					frameSnapResult = null;
				}
			});

			// Apply snap
			const snapped = applySnapToUpdates(updates, result);
			originalUpdateShape(id, snapped);

			// Update guide lines
			setLines(result.lines);
		}

		ctx.store.updateShape = patchedUpdateShape;

		// ── Register overlay guide layer (above shapes) ──

		ctx.layers.register({
			id: "snap-guides",
			order: 90,
			render: (renderCtx) => <SnapGuideOverlay viewport={renderCtx.viewport} />,
			renderTarget: "html",
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
			setLines([]);
			lineListeners.clear();
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
	// Screen (0,0) → world top-left, screen (window.innerWidth, window.innerHeight) → world bottom-right
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
