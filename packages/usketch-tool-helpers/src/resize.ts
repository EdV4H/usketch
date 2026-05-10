import type {
	BoundingBox,
	CanvasPointerEvent,
	Point,
	ResizeHandle,
	ShapeData,
	ToolContext,
} from "@edv4h/usketch-shared";
import {
	bidiffShape,
	deltaToLocal,
	diffShape,
	safeRotation,
	unrotatePoint,
} from "@edv4h/usketch-shared";
import { createBatchUpdateShapesCommand, createUpdateShapeCommand } from "@edv4h/usketch-store";
import {
	applyFlip,
	computeMultiResizeUpdates,
	computeRawBounds,
	computeRelativeProps,
	fixAnchorDrift,
	getAnchorEdges,
	type MultiResizeShapeEntry,
} from "./internal/resize-handles.js";
import type { SessionCommit, ShapeUpdateMap, ToolSession } from "./types.js";

export type { MultiResizeShapeEntry };

export interface ResizeUpdate {
	updates: ShapeUpdateMap;
	/**
	 * If the pointer crossed an anchor edge during this update, the
	 * `handle` field reflects the new (flipped) handle the next update
	 * will use. Tools should refresh their cursor to match.
	 */
	flippedHandle?: ResizeHandle;
}

export type ResizeSessionOptions =
	| {
			kind: "single";
			ctx: ToolContext;
			shapeId: string;
			handle: ResizeHandle;
			startPoint: Point;
	  }
	| {
			kind: "multi";
			ctx: ToolContext;
			selection: ReadonlySet<string>;
			handle: ResizeHandle;
			startPoint: Point;
			groupBounds: BoundingBox;
	  };

/**
 * Resize session — extracted from `plugin-tool-select`'s `mode: "resize"`
 * (single shape) and `mode: "multi-resize"` (group bounding box) branches.
 *
 * **Single mode**: applies the shape definition's `def.resize()` against
 * an un-rotated local-space delta, fixes anchor drift from min-size
 * clamping, and detects flips when the pointer crosses an anchor edge.
 *
 * **Multi mode**: maintains each shape's relative position/size within
 * the group bounding box (0..1 normalized), recomputes per-shape bounds
 * via `computeMultiResizeUpdates`, then optionally pipes through each
 * shape's `def.applyBounds()` so non-trivial geometry (e.g. lines)
 * snaps correctly.
 */
export function startResizeSession(
	opts: ResizeSessionOptions,
): ToolSession<ResizeUpdate, SessionCommit> {
	if (opts.kind === "single") return createSingleResizeSession(opts);
	return createMultiResizeSession(opts);
}

// ── Single-shape resize ──────────────────────────────────────────────

interface SingleState {
	handle: ResizeHandle;
	startPoint: Point;
	startData: ShapeData;
}

function createSingleResizeSession(opts: {
	kind: "single";
	ctx: ToolContext;
	shapeId: string;
	handle: ResizeHandle;
	startPoint: Point;
}): ToolSession<ResizeUpdate, SessionCommit> {
	const { ctx, shapeId } = opts;
	const initialShape = ctx.store.getShape(shapeId);
	if (!initialShape) throw new Error(`startResizeSession: shape ${shapeId} not found`);

	let state: SingleState = {
		handle: opts.handle,
		startPoint: opts.startPoint,
		startData: { ...initialShape },
	};
	const initialSnapshot = { ...initialShape };
	let cancelled = false;

	return {
		update(event: CanvasPointerEvent): ResizeUpdate {
			if (cancelled) return { updates: new Map() };
			const def = ctx.shapes.get(state.startData.type);
			if (!def) return { updates: new Map() };

			const rotation = safeRotation(state.startData.rotation);
			const worldDelta: Point = {
				x: event.worldPoint.x - state.startPoint.x,
				y: event.worldPoint.y - state.startPoint.y,
			};
			const delta = rotation ? deltaToLocal(worldDelta, rotation) : worldDelta;

			const rawBounds = computeRawBounds(state.startData, state.handle, delta);
			let worldPointForFlip = event.worldPoint;
			if (rotation) {
				const center = {
					x: rawBounds.x + rawBounds.width / 2,
					y: rawBounds.y + rawBounds.height / 2,
				};
				worldPointForFlip = unrotatePoint(event.worldPoint, center, (rotation * Math.PI) / 180);
			}
			const flip = applyFlip(state.handle, rawBounds, worldPointForFlip);
			if (flip.flipped) {
				const current = ctx.store.getShape(shapeId);
				if (current) {
					const anchor = getAnchorEdges(state.handle, rawBounds);
					const flippedData = { ...current };
					if (flip.flippedX && anchor.x !== undefined) {
						flippedData.x = anchor.x;
						flippedData.width = 0;
					}
					if (flip.flippedY && anchor.y !== undefined) {
						flippedData.y = anchor.y;
						flippedData.height = 0;
					}
					state = {
						handle: flip.handle,
						startData: flippedData,
						startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
					};
					ctx.store.updateShape(shapeId, {
						x: flippedData.x,
						y: flippedData.y,
					});
					const updates: ShapeUpdateMap = new Map([
						[shapeId, { x: flippedData.x, y: flippedData.y }],
					]);
					return { updates, flippedHandle: flip.handle };
				}
			}

			const resized = def.resize(state.startData, state.handle, delta);
			const fixed = fixAnchorDrift(state.handle, state.startData, resized);
			resized.x = fixed.x;
			resized.y = fixed.y;
			const patch = diffShape(state.startData, resized);
			const updates: ShapeUpdateMap = new Map();
			if (Object.keys(patch).length > 0) {
				ctx.store.updateShape(shapeId, patch);
				updates.set(shapeId, patch);
			}
			return { updates };
		},

		commit(): SessionCommit | null {
			if (cancelled) return null;
			const current = ctx.store.getShape(shapeId);
			if (!current) return null;
			const { from, to } = bidiffShape(initialSnapshot, current);
			if (Object.keys(to).length === 0) return null;
			ctx.store.updateShape(shapeId, from);
			return { command: createUpdateShapeCommand(ctx.store, shapeId, from, to) };
		},

		cancel(): void {
			if (cancelled) return;
			cancelled = true;
			ctx.store.updateShape(shapeId, initialSnapshot);
		},
	};
}

// ── Multi-selection resize ───────────────────────────────────────────

interface MultiState {
	handle: ResizeHandle;
	startPoint: Point;
	startGroupBounds: BoundingBox;
	startShapeData: Map<string, MultiResizeShapeEntry>;
	applyBoundsBase: Map<string, ShapeData>;
}

function createMultiResizeSession(opts: {
	kind: "multi";
	ctx: ToolContext;
	selection: ReadonlySet<string>;
	handle: ResizeHandle;
	startPoint: Point;
	groupBounds: BoundingBox;
}): ToolSession<ResizeUpdate, SessionCommit> {
	const { ctx, selection } = opts;
	const startShapeData = new Map<string, MultiResizeShapeEntry>();
	const originalFullShapes = new Map<string, ShapeData>();
	for (const id of selection) {
		const shape = ctx.store.getShape(id);
		if (!shape) continue;
		originalFullShapes.set(id, { ...shape });
		const def = ctx.shapes.get(shape.type);
		const minSize = def?.minSize ?? { width: 1, height: 1 };
		const rel = computeRelativeProps(
			{ x: shape.x, y: shape.y, width: shape.width, height: shape.height },
			opts.groupBounds,
		);
		startShapeData.set(id, {
			x: shape.x,
			y: shape.y,
			width: shape.width,
			height: shape.height,
			minWidth: minSize.width,
			minHeight: minSize.height,
			...rel,
		});
	}

	let state: MultiState = {
		handle: opts.handle,
		startPoint: opts.startPoint,
		startGroupBounds: opts.groupBounds,
		startShapeData,
		applyBoundsBase: new Map(originalFullShapes),
	};
	let cancelled = false;

	return {
		update(event: CanvasPointerEvent): ResizeUpdate {
			if (cancelled) return { updates: new Map() };
			const delta: Point = {
				x: event.worldPoint.x - state.startPoint.x,
				y: event.worldPoint.y - state.startPoint.y,
			};

			const rawGroupBounds = computeRawBounds(state.startGroupBounds, state.handle, delta);
			const flip = applyFlip(state.handle, rawGroupBounds, event.worldPoint);
			if (flip.flipped) {
				const anchor = getAnchorEdges(state.handle, rawGroupBounds);
				const flippedGroupBounds = { ...state.startGroupBounds };
				if (flip.flippedX && anchor.x !== undefined) {
					flippedGroupBounds.x = anchor.x;
					flippedGroupBounds.width = 0;
				}
				if (flip.flippedY && anchor.y !== undefined) {
					flippedGroupBounds.y = anchor.y;
					flippedGroupBounds.height = 0;
				}
				const flippedShapeData = new Map<string, MultiResizeShapeEntry>();
				for (const [id, data] of state.startShapeData) {
					const newRel = { ...data };
					if (flip.flippedX) {
						newRel.relX = 1 - data.relX - data.relWidth;
						newRel.x = flippedGroupBounds.x;
						newRel.width = 0;
					}
					if (flip.flippedY) {
						newRel.relY = 1 - data.relY - data.relHeight;
						newRel.y = flippedGroupBounds.y;
						newRel.height = 0;
					}
					flippedShapeData.set(id, newRel);
				}
				// Temporarily disable snap during flip-reset (matches tool-select).
				ctx.events.emit("snap:configure", { enabled: false });
				const flipUpdates: ShapeUpdateMap = new Map();
				for (const [id, data] of flippedShapeData) {
					const update: Partial<ShapeData> = {};
					if (flip.flippedX) {
						update.x = data.x;
						update.width = 0;
					}
					if (flip.flippedY) {
						update.y = data.y;
						update.height = 0;
					}
					ctx.store.updateShape(id, update);
					flipUpdates.set(id, update);
				}
				ctx.events.emit("snap:configure", { enabled: true });
				const flippedApplyBoundsBase = new Map<string, ShapeData>();
				for (const id of flippedShapeData.keys()) {
					const current = ctx.store.getShape(id);
					if (current) flippedApplyBoundsBase.set(id, { ...current });
				}
				state = {
					handle: flip.handle,
					startPoint: { x: event.worldPoint.x, y: event.worldPoint.y },
					startGroupBounds: flippedGroupBounds,
					startShapeData: flippedShapeData,
					applyBoundsBase: flippedApplyBoundsBase,
				};
				return { updates: flipUpdates, flippedHandle: flip.handle };
			}

			const multiUpdates = computeMultiResizeUpdates(
				state.handle,
				state.startGroupBounds,
				delta,
				state.startShapeData,
			);
			const updates: ShapeUpdateMap = new Map();
			for (const [id, upd] of multiUpdates) {
				const baseShape = state.applyBoundsBase.get(id);
				const def = baseShape ? ctx.shapes.get(baseShape.type) : undefined;
				if (def?.applyBounds && baseShape) {
					ctx.store.updateShape(id, upd);
					const snapped = ctx.store.getShape(id);
					if (snapped) {
						const snappedBounds = {
							x: snapped.x,
							y: snapped.y,
							width: snapped.width,
							height: snapped.height,
						};
						const geom = def.applyBounds(baseShape, snappedBounds);
						const { x: _x, y: _y, width: _w, height: _h, ...rest } = geom;
						if (Object.keys(rest).length > 0) {
							ctx.store.updateShape(id, rest);
							updates.set(id, { ...upd, ...rest });
						} else {
							updates.set(id, upd);
						}
					} else {
						updates.set(id, upd);
					}
				} else {
					ctx.store.updateShape(id, upd);
					updates.set(id, upd);
				}
			}
			return { updates };
		},

		commit(): SessionCommit | null {
			if (cancelled) return null;
			const batchUpdates: Array<{
				id: string;
				from: Partial<ShapeData>;
				to: Partial<ShapeData>;
			}> = [];
			for (const [id, origFullShape] of originalFullShapes) {
				const currentShape = ctx.store.getShape(id);
				if (!currentShape) continue;
				const { from, to } = bidiffShape(origFullShape, currentShape);
				if (Object.keys(to).length > 0) batchUpdates.push({ id, from, to });
			}
			if (batchUpdates.length === 0) return null;
			for (const { id, from } of batchUpdates) {
				ctx.store.updateShape(id, from);
			}
			return {
				command: createBatchUpdateShapesCommand(ctx.store, batchUpdates),
			};
		},

		cancel(): void {
			if (cancelled) return;
			cancelled = true;
			for (const [id, original] of originalFullShapes) {
				ctx.store.updateShape(id, original);
			}
		},
	};
}
