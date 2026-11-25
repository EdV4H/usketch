import type {
	BoardStore,
	BoundingBox,
	CanvasPointerEvent,
	PluginContext,
	ShapeData,
	UsketchPlugin,
	Viewport,
} from "@edv4h/usketch-shared";
import { getShapeWorldAABB, safeRotation, screenRectToWorldBounds } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import { effectiveSnapEnabled, isSnapToggleKey } from "./alt-behavior.js";
import { DEFAULT_GUIDE_STYLE, DEFAULT_SNAP_THRESHOLD } from "./constants.js";
import {
	buildSizeGuides,
	findSizeSnap,
	getResizeEdges,
	resizeKeepingAnchor,
	type SizeCandidate,
} from "./engine/size-snap.js";
import { calculateSnap, type SnapEdgeFilter } from "./engine/snap-engine.js";
import type {
	AltBehavior,
	GuideStyle,
	SizeGuide,
	SnapEdge,
	SnapLine,
	SnapResult,
	SnapSettings,
	SpacingGuide,
} from "./engine/types.js";
import { getNearestFrameAncestor } from "./frame-ancestor.js";
import { GuideLayer } from "./guide-layer.js";

// ── Shared mutable state for the plugin ──

interface SnapGuideState {
	lines: SnapLine[];
	gaps: SpacingGuide[];
	sizes: SizeGuide[];
	guideStyle: GuideStyle;
}

let currentState: SnapGuideState = {
	lines: [],
	gaps: [],
	sizes: [],
	guideStyle: { ...DEFAULT_GUIDE_STYLE },
};
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

function toScreenGaps(
	gaps: SpacingGuide[],
	vp: { x: number; y: number; zoom: number },
): SpacingGuide[] {
	return gaps.map((g) => ({
		...g,
		// Convert `length` too so the returned guide is entirely in screen units
		// (no world/screen mixing). The world-space length stays available on
		// `state.gaps` for anything semantic (e.g. a future gap label).
		length: g.length * vp.zoom,
		segments: g.segments.map((s) => {
			if (g.axis === "x") {
				return {
					start: worldToScreen(s.start, 0, vp).x,
					end: worldToScreen(s.end, 0, vp).x,
					cross: worldToScreen(0, s.cross, vp).y,
				};
			}
			return {
				start: worldToScreen(0, s.start, vp).y,
				end: worldToScreen(0, s.end, vp).y,
				cross: worldToScreen(s.cross, 0, vp).x,
			};
		}),
	}));
}

function toScreenSizes(
	sizes: SizeGuide[],
	vp: { x: number; y: number; zoom: number },
): SizeGuide[] {
	return sizes.map((g) => {
		if (g.kind === "square") {
			return {
				...g,
				from: worldToScreen(g.from.x, g.from.y, vp),
				to: worldToScreen(g.to.x, g.to.y, vp),
			};
		}
		const [screen] = toScreenGaps([{ axis: g.axis, length: 0, segments: g.segments }], vp);
		return { ...g, segments: screen.segments };
	});
}

function SnapGuideOverlay({ viewport }: SnapGuideOverlayProps) {
	const state = useSyncExternalStore(subscribeState, getState, getState);
	if (state.lines.length === 0 && state.gaps.length === 0 && state.sizes.length === 0) {
		return null;
	}

	const screenLines = toScreenLines(state.lines, viewport);
	const screenGaps = toScreenGaps(state.gaps, viewport);
	const screenSizes = toScreenSizes(state.sizes, viewport);

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
			<GuideLayer
				lines={screenLines}
				gaps={screenGaps}
				sizes={screenSizes}
				style={state.guideStyle}
			/>
		</svg>
	);
}

// ── Plugin ──

export interface SnapPluginOptions {
	/** 初期のスナップ有効状態（既定 true）。 */
	enabled?: boolean;
	/**
	 * スナップ一時切替キー（Ctrl / Cmd）の挙動（既定 "suppress"）。"invert" で無効時も
	 * Ctrl / Cmd で一時スナップ。名前は互換のため。Alt(Option) はドラッグ複製に使うので切替に使わない。
	 */
	altBehavior?: AltBehavior;
	/** 等間隔（distribution）スナップ＝gap 複製＋gap 中央（既定 true）。 */
	distributeSnap?: boolean;
	/**
	 * 単体リサイズ（新規描画を含む）中、縦横が同じ長さになったら吸着する（既定 true）。
	 * 回転した図形にも効く。HUD の「Square snap」で切替。
	 */
	squareSnap?: boolean;
	/**
	 * 単体リサイズ（新規描画を含む）中、近くの図形と同じ幅・高さに吸着する（既定 true）。
	 * 回転した図形には効かない。HUD の「Same-size snap」で切替。
	 */
	sameSizeSnap?: boolean;
}

export function createSnapPlugin(options: SnapPluginOptions = {}): UsketchPlugin {
	return {
		id: "usketch-plugin-snap",
		name: "スナップ",

		setup(ctx: PluginContext) {
			const settings: SnapSettings = {
				enabled: options.enabled ?? true,
				threshold: DEFAULT_SNAP_THRESHOLD,
				edgeSnap: true,
				centerSnap: true,
				distributeSnap: options.distributeSnap ?? true,
				squareSnap: options.squareSnap ?? true,
				sameSizeSnap: options.sameSizeSnap ?? true,
				viewportOnly: true,
				guideStyle: { ...DEFAULT_GUIDE_STYLE },
				altBehavior: options.altBehavior ?? "suppress",
			};

			// Sync initial guide style to shared state
			setState({ guideStyle: settings.guideStyle });

			let pointerDown = false;
			let altKeyHeld = false;

			// Frame-level caches for multi-shape snap consistency
			let frameSnapResult: SnapResult | null = null;
			let frameCandidateBoxes: Map<string, BoundingBox> | null = null;
			let frameId = 0;

			// Whether each shape resized in this drag sizes its width and height
			// independently (see resizesAxesIndependently); cleared per pointer-down.
			const independentAxes = new Map<string, boolean>();

			// ── Pointer tracking ──

			const offPointerDown = ctx.events.on<CanvasPointerEvent>("canvas:pointerdown", () => {
				pointerDown = true;
				independentAxes.clear();
				frameSnapResult = null;
				frameCandidateBoxes = null;
				setState({ lines: [], gaps: [], sizes: [] });
			});

			const offPointerUp = ctx.events.on<CanvasPointerEvent>("canvas:pointerup", () => {
				pointerDown = false;
				frameSnapResult = null;
				frameCandidateBoxes = null;
				setState({ lines: [], gaps: [], sizes: [] });
			});

			// ── Toggle key tracking (Ctrl / Cmd) ──

			function onKeyDown(e: KeyboardEvent) {
				if (isSnapToggleKey(e.key)) altKeyHeld = true;
			}
			function onKeyUp(e: KeyboardEvent) {
				if (isSnapToggleKey(e.key)) altKeyHeld = false;
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

			// ── 操作を Action として公開（Control HUD が自動でUI化） ──
			const offSnapAction = ctx.actions.register({
				id: "snap:toggle",
				label: "Snap",
				group: "Snap",
				isActive: () => settings.enabled,
				run: () => ctx.events.emit("snap:configure", { enabled: !settings.enabled }),
			});
			// Size snaps while resizing, each on its own switch.
			const offSquareAction = ctx.actions.register({
				id: "snap:toggle-square",
				label: "Square snap",
				group: "Snap",
				isActive: () => settings.squareSnap !== false,
				run: () => ctx.events.emit("snap:configure", { squareSnap: settings.squareSnap === false }),
			});
			const offSameSizeAction = ctx.actions.register({
				id: "snap:toggle-same-size",
				label: "Same-size snap",
				group: "Snap",
				isActive: () => settings.sameSizeSnap !== false,
				run: () =>
					ctx.events.emit("snap:configure", { sameSizeSnap: settings.sameSizeSnap === false }),
			});

			// ── Monkey-patch store.updateShape ──

			const originalUpdateShape = ctx.store.updateShape.bind(ctx.store);

			function patchedUpdateShape(id: string, updates: Partial<ShapeData>) {
				const effectiveEnabled = effectiveSnapEnabled(
					settings.enabled,
					altKeyHeld,
					settings.altBehavior,
				);
				const shouldSnap = pointerDown && effectiveEnabled && hasPositionUpdate(updates);

				if (!shouldSnap) {
					originalUpdateShape(id, updates);
					// スナップしないドラッグ中はガイドを消す。
					if (pointerDown) {
						setState({ lines: [], gaps: [], sizes: [] });
					}
					return;
				}

				const shape = ctx.store.getShape(id);
				if (!shape) {
					originalUpdateShape(id, updates);
					return;
				}

				// A rotation (its updates carry `rotation`, e.g. a shape orbiting the
				// pivot of a multi-selection rotation) never snaps: snapping would pull
				// the shape off the circle it turns on.
				if ("rotation" in updates) {
					originalUpdateShape(id, updates);
					return;
				}

				// Skip snap for connectors — they have their own anchor/snap logic
				if (shape.type === "connector") {
					originalUpdateShape(id, updates);
					setState({ lines: [], gaps: [], sizes: [] });
					return;
				}

				// Skip snap for shapes a consumer excluded from snapping entirely
				// (e.g. a container's child following its dragged parent). Excluded
				// shapes are neither snapped when moved nor used as snap targets.
				// Leave the guide lines untouched: these child updates are interleaved
				// with the dragged parent's snapped update, and clearing lines here
				// would wipe the parent's snap feedback mid-drag.
				if (settings.excludeTargets?.(shape)) {
					originalUpdateShape(id, updates);
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

				// A rotated shape is resized along its own (turned) axes, which the
				// axis-aligned guides can't line up with: no alignment snap. Being a
				// square doesn't depend on the turn, so it may still square up.
				const rotation = safeRotation(shape.rotation);
				if (isResize && rotation !== 0) {
					const sized = isSingleResize(id)
						? snapSize(shape, updates, updates, rotation, null, null)
						: null;
					originalUpdateShape(id, sized?.updates ?? updates);
					setState({ lines: [], gaps: [], sizes: sized?.guides ?? [] });
					return;
				}

				// Get current frame ID to cache snap results across multi-shape updates
				const currentFrame = frameId;

				// The rest of a multi-shape drag in the same frame reuses the first
				// shape's snap result. A move only needs the cached delta, so don't
				// build the selection's bounding box here: doing it for every dragged
				// shape made one pointermove O(selected²).
				// (`frameSnapResult` is cleared by the microtask that ends the frame.)
				if (frameSnapResult) {
					const snapped = isResize
						? applySnapToResize(
								updates,
								frameSnapResult,
								shape,
								getResizedBoundingBox(shape, updates),
							)
						: applySnapToUpdates(updates, frameSnapResult);
					originalUpdateShape(id, snapped);
					return;
				}

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

				const candidateBoxes =
					frameCandidateBoxes ??
					getCandidateBoxes(
						ctx.store,
						ctx,
						movingIds,
						settings.viewportOnly ? ctx.store.getViewport() : null,
						settings.excludeTargets,
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

				// Size snap (square / another shape's size) on the axes alignment left free.
				const lock = { x: result.xEdge !== null, y: result.yEdge !== null };
				const sized =
					isResize && movingIds.size === 1
						? snapSize(shape, updates, snapped, 0, lock, candidateBoxes)
						: null;
				if (!sized) {
					originalUpdateShape(id, snapped);
					setState({ lines: result.lines, gaps: result.gaps ?? [], sizes: [] });
					return;
				}
				originalUpdateShape(id, sized.updates);
				// The alignment guides were laid out on the box before its free axis
				// changed size: lay them out again on the final box. Its aligned edges
				// sit exactly on their lines now, so only those match again.
				const lines =
					lock.x || lock.y
						? calculateSnap(
								getResizedBoundingBox(shape, sized.updates),
								movingIds,
								candidateBoxes,
								settings,
								movingOverrides,
								{
									xEdges: result.xEdge ? [result.xEdge] : [],
									yEdges: result.yEdge ? [result.yEdge] : [],
								},
							).lines
						: [];
				setState({ lines, gaps: [], sizes: sized.guides });
			}

			/** Not one shape of a multi-selection resize (those keep their relative sizes). */
			function isSingleResize(id: string): boolean {
				const sel = ctx.store.getSelection();
				return !(sel.size > 1 && sel.has(id));
			}

			/**
			 * Whether the shape's `resize` sizes width and height independently:
			 * dragging its right edge leaves the height alone. An aspect-locked shape
			 * (e.g. an image keeping its ratio) or a box fitting its height to its
			 * text fails this and is never size-snapped (that would break its ratio).
			 */
			function resizesAxesIndependently(shape: ShapeData): boolean {
				const cached = independentAxes.get(shape.id);
				if (cached !== undefined) return cached;
				const def = ctx.shapes.get(shape.type);
				let independent = true;
				if (def?.resize) {
					// Probe on a roomy box so a min-size clamp (a 0×0 shape being
					// drawn) can't move the height.
					const base = {
						...shape,
						width: Math.max(shape.width, 100),
						height: Math.max(shape.height, 100),
					};
					const probed = def.resize(base, "e", { x: 10, y: 0 });
					independent = Math.abs(probed.height - base.height) < 1e-6;
				}
				independentAxes.set(shape.id, independent);
				return independent;
			}

			/**
			 * Size-snap a single resize. `raw` is the resize as the tool sent it (to
			 * tell which edges move); `current` is it after any alignment snap.
			 * `lock` names the axes alignment fixed; `candidateBoxes` are the shapes
			 * whose size can be matched (`null`: square only, for a rotated shape).
			 */
			function snapSize(
				shape: ShapeData,
				raw: Partial<ShapeData>,
				current: Partial<ShapeData>,
				rotation: number,
				lock: { x: boolean; y: boolean } | null,
				candidateBoxes: ReadonlyMap<string, BoundingBox> | null,
			): { updates: Partial<ShapeData>; guides: SizeGuide[] } | null {
				const square = settings.squareSnap !== false;
				const sameSize = settings.sameSizeSnap !== false;
				if (!square && !sameSize) return null;
				if (!resizesAxesIndependently(shape)) return null;
				const edges = getResizeEdges(shape, getResizedBoundingBox(shape, raw), rotation);
				const box = getResizedBoundingBox(shape, current);
				const candidates: SizeCandidate[] = [];
				for (const [cid, b] of sameSize && candidateBoxes ? candidateBoxes : []) {
					// A turned shape's bounds aren't its width and height.
					if (safeRotation(ctx.store.getShape(cid)?.rotation) !== 0) continue;
					candidates.push({ id: cid, width: b.width, height: b.height });
				}
				const match = findSizeSnap({
					width: box.width,
					height: box.height,
					edges,
					lockX: lock?.x,
					lockY: lock?.y,
					square,
					candidates,
					threshold: settings.threshold,
				});
				if (!match) return null;
				const next = resizeKeepingAnchor(box, edges, match.width, match.height, rotation);
				return {
					updates: { ...current, ...next },
					guides: buildSizeGuides(next, edges, match, candidateBoxes ?? new Map(), rotation),
				};
			}

			ctx.store.updateShape = patchedUpdateShape;

			// ── Register overlay guide layer (above shapes) ──

			ctx.layers.register({
				id: "snap-guides",
				view3d: "tilt",
				order: 90,
				fixed: true,
				// World-anchored: follow the camera rotation (see Layer.worldOverlay).
				worldOverlay: true,
				render: (renderCtx) => <SnapGuideOverlay viewport={renderCtx.viewport} />,
			});

			// ── Teardown ──

			return () => {
				offPointerDown();
				offPointerUp();
				offConfigure();
				offGetSettings();
				offSnapAction();
				offSquareAction();
				offSameSizeAction();
				window.removeEventListener("keydown", onKeyDown);
				window.removeEventListener("keyup", onKeyUp);
				window.removeEventListener("blur", onBlur);
				ctx.store.updateShape = originalUpdateShape;
				ctx.layers.unregister("snap-guides");
				setState({ lines: [], gaps: [], sizes: [], guideStyle: { ...DEFAULT_GUIDE_STYLE } });
				stateListeners.clear();
			};
		},
	};
}

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

		// Rotation-aware, like the candidate boxes.
		const box = getShapeWorldAABB({ ...shape, x: shape.x + dx, y: shape.y + dy });

		minX = Math.min(minX, box.x);
		minY = Math.min(minY, box.y);
		maxX = Math.max(maxX, box.x + box.width);
		maxY = Math.max(maxY, box.y + box.height);
	}

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

function getVisibleWorldRect(viewport: Viewport): BoundingBox {
	// Rotation-aware (AABB of the turned screen); identical to the plain rect unrotated.
	return screenRectToWorldBounds(window.innerWidth, window.innerHeight, viewport);
}

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function getCandidateBoxes(
	store: BoardStore,
	ctx: PluginContext,
	movingIds: ReadonlySet<string>,
	viewport: Viewport | null,
	excludeTargets?: (shape: ShapeData) => boolean,
): Map<string, BoundingBox> {
	const visibleRect = viewport ? getVisibleWorldRect(viewport) : null;

	// Determine the nearest frame-like ancestor of moving shapes (see
	// getNearestFrameAncestor). This correctly handles shapes inside groups within frames.
	let movingFrameId: string | null | undefined;
	for (const id of movingIds) {
		const frameId = getNearestFrameAncestor(store, ctx.shapes, id);
		if (movingFrameId === undefined) {
			movingFrameId = frameId;
		} else if (movingFrameId !== frameId) {
			// Mixed frame contexts — skip frame-based filtering
			movingFrameId = undefined;
			break;
		}
	}

	const boxes = new Map<string, BoundingBox>();
	for (const [id, shape] of store.getShapes()) {
		if (movingIds.has(id)) continue;
		// Connectors are never snap targets
		if (shape.type === "connector") continue;
		// Consumer-excluded shapes are never snap targets
		if (excludeTargets?.(shape)) continue;
		// Exclude children of moving shapes so a frame doesn't snap to its own children
		const parentId = shape.parentId as string | undefined;
		if (parentId && movingIds.has(parentId)) continue;

		// Cull off-screen shapes before the frame-context check below: that check
		// walks the parent chain, and on a large board most shapes are off-screen.
		const def = ctx.shapes.get(shape.type);
		// Where the shape is drawn: a rotated shape snaps by its turned outline's bounds.
		const box = getShapeWorldAABB(
			shape,
			def
				? def.getBounds(shape)
				: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
		);
		if (visibleRect && !boxesOverlap(box, visibleRect)) continue;

		// Only snap within the same frame context:
		// - If moving shapes are inside a frame, only snap to shapes in the same frame
		//   (also allow snapping to the parent frame itself)
		// - If moving shapes are top-level, don't snap to shapes inside frames
		if (movingFrameId !== undefined) {
			const candidateFrameId = getNearestFrameAncestor(store, ctx.shapes, id);
			if (candidateFrameId !== movingFrameId && id !== movingFrameId) continue;
		}

		boxes.set(id, box);
	}
	return boxes;
}
