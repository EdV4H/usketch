import type { CanvasPointerEvent, Point, ShapeData, ToolContext } from "@edv4h/usketch-shared";
import { normalizeAngle, safeRotation, snapAngle } from "@edv4h/usketch-shared";
import { collectChildrenOnly } from "./internal/descendants.js";
import type { SessionCommit, ShapeUpdateMap, ToolSession } from "./types.js";

export interface RotateUpdate {
	/** New rotation of the root shape (degrees, normalized to [0, 360)). */
	rotation: number;
	/** Per-shape diff this update applied to the store (root + children). */
	updates: ShapeUpdateMap;
}

export interface RotateSessionOptions {
	ctx: ToolContext;
	/** Root shape to rotate. Children are auto-collected if it's a container. */
	shapeId: string;
	/**
	 * World-space center to rotate around — typically the shape's bbox center
	 * at session start. Stays fixed for the duration of the drag.
	 */
	center: Point;
	/**
	 * Angle (in degrees) from `center` to the pointerdown world point. Used
	 * with the live pointer angle to derive a delta. Caller computes via
	 * `Math.atan2(worldY - cy, worldX - cx) * (180 / Math.PI)`.
	 */
	startAngle: number;
	/** The shape's rotation at session start, in degrees. */
	startRotation: number;
	/**
	 * If true (default), rotates child shapes around `center` so the whole
	 * container appears to rotate as a rigid body. Set to `false` for
	 * non-container shapes or when the caller wants to rotate only the root.
	 */
	rotateChildren?: boolean;
	/**
	 * Snap step (degrees) applied when the pointer event has `shiftKey: true`.
	 * Default 15. Pass `0` to disable shift-snap entirely.
	 */
	snapStep?: number;
}

/** Point-array keys that only point-defined shapes (connectors) carry. */
const POINT_KEYS = ["sourcePoint", "targetPoint", "controlPoint"] as const;

/**
 * Snapshot the rotation-relevant keys of a shape for undo before/after.
 *
 * Core transform keys (x/y/width/height/rotation) are always emitted — notably
 * `rotation` is normalized to a number so a shape that started with no rotation
 * can still be reverted to `0` (the before/after key sets must match for undo).
 * Point-array keys are included only when present (connectors).
 */
function pickRotationKeys(shape: ShapeData): Partial<ShapeData> {
	const src = shape as unknown as Record<string, unknown>;
	const out: Record<string, unknown> = {
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
		rotation: safeRotation(shape.rotation),
	};
	for (const k of POINT_KEYS) {
		if (k in src) out[k] = src[k];
	}
	return out as Partial<ShapeData>;
}

/**
 * Rigid-body rotation patch for one shape rotated by `deltaDeg` around `center`.
 * Point-defined shapes (connectors) use their `def.rotate` hook so their absolute
 * points are rotated instead of a `rotation` value being baked (which would
 * double-transform them). Shared by container-child rotation and multi-selection
 * rotation.
 */
function rigidRotatePatch(
	ctx: ToolContext,
	snap: ShapeData,
	deltaDeg: number,
	center: Point,
): Partial<ShapeData> {
	const deltaRad = (deltaDeg * Math.PI) / 180;
	const def = ctx.shapes.get(snap.type);
	if (def?.rotate) return def.rotate(snap, deltaRad, center);
	const cx = snap.x + snap.width / 2;
	const cy = snap.y + snap.height / 2;
	const rx = cx - center.x;
	const ry = cy - center.y;
	const cos = Math.cos(deltaRad);
	const sin = Math.sin(deltaRad);
	const newCx = center.x + rx * cos - ry * sin;
	const newCy = center.y + rx * sin + ry * cos;
	return {
		x: newCx - snap.width / 2,
		y: newCy - snap.height / 2,
		rotation: normalizeAngle(safeRotation(snap.rotation) + deltaDeg),
	};
}

/**
 * Rotate session — extracted from `plugin-tool-select`'s `mode: "rotate"`.
 * Tracks angle delta from session start, applies snap on shift, normalizes
 * to [0, 360), and rotates container children rigidly around `center`.
 *
 * `commit()` returns a single command that batch-applies the rotation to
 * the root and all rotated children. The session's revert-then-replay
 * pattern preserves undo correctness even after intermediate `updateShape`
 * calls have already mutated the store.
 */
export function startRotateSession(
	opts: RotateSessionOptions,
): ToolSession<RotateUpdate, SessionCommit> {
	const {
		ctx,
		shapeId,
		center,
		startAngle,
		startRotation,
		rotateChildren = true,
		snapStep = 15,
	} = opts;

	const childSnapshots = rotateChildren
		? collectChildrenOnly(ctx, shapeId)
		: new Map<string, ShapeData>();

	const rootSnapshot = ctx.store.getShape(shapeId);
	let lastUpdate: RotateUpdate = {
		rotation: startRotation,
		updates: new Map(),
	};
	let cancelled = false;

	return {
		update(event: CanvasPointerEvent): RotateUpdate {
			if (cancelled) return lastUpdate;
			const currentAngle =
				Math.atan2(event.worldPoint.y - center.y, event.worldPoint.x - center.x) * (180 / Math.PI);
			// Wrap to [-180, 180] to avoid ±360° jumps near the atan2 seam.
			let angleDiff = currentAngle - startAngle;
			angleDiff = ((angleDiff + 540) % 360) - 180;
			let newRotation = startRotation + angleDiff;
			if (event.shiftKey && snapStep > 0) {
				newRotation = snapAngle(newRotation, snapStep);
			}
			newRotation = normalizeAngle(newRotation);

			const updates: ShapeUpdateMap = new Map();
			ctx.store.updateShape(shapeId, { rotation: newRotation });
			updates.set(shapeId, { rotation: newRotation });

			// Rigid-body rotation of children around `center`.
			const childDelta = newRotation - startRotation;
			for (const [childId, snap] of childSnapshots) {
				const patch = rigidRotatePatch(ctx, snap, childDelta, center);
				ctx.store.updateShape(childId, patch);
				updates.set(childId, patch);
			}

			lastUpdate = { rotation: newRotation, updates };
			return lastUpdate;
		},

		commit(): SessionCommit | null {
			if (cancelled) return null;
			const current = ctx.store.getShape(shapeId);
			if (!rootSnapshot || !current) return null;

			const beforeSnapshots = new Map<string, Partial<ShapeData>>();
			const afterSnapshots = new Map<string, Partial<ShapeData>>();
			const beforeRotation = startRotation;
			const afterRotation = safeRotation(current.rotation);
			if (beforeRotation === afterRotation) return null;

			beforeSnapshots.set(shapeId, { rotation: beforeRotation });
			afterSnapshots.set(shapeId, { rotation: afterRotation });

			for (const [childId, snap] of childSnapshots) {
				const child = ctx.store.getShape(childId);
				if (!child) continue;
				// Capture the full rotation-relevant key set so point-defined children
				// (connectors: sourcePoint/targetPoint/...) undo/redo correctly, not
				// just x/y/rotation.
				beforeSnapshots.set(childId, pickRotationKeys(snap));
				afterSnapshots.set(childId, pickRotationKeys(child));
			}

			// Revert so the command's execute() replays cleanly. Mirrors
			// tool-select's queueMicrotask deferred-execute idiom — callers
			// schedule the actual command.execute() via microtask so any
			// pointer-up cleanup completes first.
			for (const [id, props] of beforeSnapshots) {
				ctx.store.updateShape(id, props);
			}

			return {
				command: {
					execute() {
						for (const [id, props] of afterSnapshots) {
							ctx.store.updateShape(id, props);
						}
					},
					undo() {
						for (const [id, props] of beforeSnapshots) {
							ctx.store.updateShape(id, props);
						}
					},
				},
			};
		},

		cancel(): void {
			if (cancelled) return;
			cancelled = true;
			if (rootSnapshot) {
				ctx.store.updateShape(shapeId, { rotation: startRotation });
			}
			for (const [childId, snap] of childSnapshots) {
				ctx.store.updateShape(childId, pickRotationKeys(snap));
			}
		},
	};
}

export interface MultiRotateSessionOptions {
	ctx: ToolContext;
	/** Shapes to rotate rigidly as a group (typically the current selection). */
	ids: Iterable<string>;
	/** World-space pivot — typically the multi-selection bbox center. Fixed for the drag. */
	center: Point;
	/**
	 * Angle (degrees) from `center` to the pointerdown world point. Combined with
	 * the live pointer angle to derive the rotation delta.
	 */
	startAngle: number;
	/** Snap step (degrees) applied on `shiftKey`. Default 15; `0` disables. */
	snapStep?: number;
}

/**
 * Rotate several independently-selected shapes rigidly around a shared pivot —
 * the multi-selection analogue of {@link startRotateSession}. There is no root
 * shape: every selected shape's center orbits `center` and its own rotation
 * advances by the same delta (point-defined shapes rotate their points via
 * `def.rotate`). Undo/redo captures each shape's full rotation-relevant keys.
 */
export function startMultiRotateSession(
	opts: MultiRotateSessionOptions,
): ToolSession<RotateUpdate, SessionCommit> {
	const { ctx, ids, center, startAngle, snapStep = 15 } = opts;

	const snapshots = new Map<string, ShapeData>();
	for (const id of ids) {
		const s = ctx.store.getShape(id);
		if (s) snapshots.set(id, s);
	}

	let lastUpdate: RotateUpdate = { rotation: 0, updates: new Map() };
	let cancelled = false;

	function currentDelta(event: CanvasPointerEvent): number {
		const currentAngle =
			Math.atan2(event.worldPoint.y - center.y, event.worldPoint.x - center.x) * (180 / Math.PI);
		// Wrap to [-180, 180] to avoid ±360° jumps near the atan2 seam.
		let delta = ((currentAngle - startAngle + 540) % 360) - 180;
		if (event.shiftKey && snapStep > 0) delta = snapAngle(delta, snapStep);
		return delta;
	}

	return {
		update(event: CanvasPointerEvent): RotateUpdate {
			if (cancelled) return lastUpdate;
			const delta = currentDelta(event);
			const updates: ShapeUpdateMap = new Map();
			for (const [id, snap] of snapshots) {
				const patch = rigidRotatePatch(ctx, snap, delta, center);
				ctx.store.updateShape(id, patch);
				updates.set(id, patch);
			}
			lastUpdate = { rotation: normalizeAngle(delta), updates };
			return lastUpdate;
		},

		commit(): SessionCommit | null {
			if (cancelled) return null;
			const before = new Map<string, Partial<ShapeData>>();
			const after = new Map<string, Partial<ShapeData>>();
			let changed = false;
			for (const [id, snap] of snapshots) {
				const cur = ctx.store.getShape(id);
				if (!cur) continue;
				before.set(id, pickRotationKeys(snap));
				after.set(id, pickRotationKeys(cur));
				if (
					safeRotation(snap.rotation) !== safeRotation(cur.rotation) ||
					snap.x !== cur.x ||
					snap.y !== cur.y
				) {
					changed = true;
				}
			}
			if (!changed) return null;

			// Revert so the command's execute() replays cleanly (mirrors startRotateSession).
			for (const [id, props] of before) {
				ctx.store.updateShape(id, props);
			}

			return {
				command: {
					execute() {
						for (const [id, props] of after) {
							ctx.store.updateShape(id, props);
						}
					},
					undo() {
						for (const [id, props] of before) {
							ctx.store.updateShape(id, props);
						}
					},
				},
			};
		},

		cancel(): void {
			if (cancelled) return;
			cancelled = true;
			for (const [id, snap] of snapshots) {
				ctx.store.updateShape(id, pickRotationKeys(snap));
			}
		},
	};
}
