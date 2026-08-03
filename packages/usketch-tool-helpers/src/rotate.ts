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
			const deltaRad = ((newRotation - startRotation) * Math.PI) / 180;
			const cos = Math.cos(deltaRad);
			const sin = Math.sin(deltaRad);
			for (const [childId, snap] of childSnapshots) {
				// Point-defined shapes (e.g. connectors) rotate their absolute points
				// via `def.rotate` and keep rotation=0 — baking a `rotation` here would
				// double-transform them against their own geometry.
				const def = ctx.shapes.get(snap.type);
				if (def?.rotate) {
					const patch = def.rotate(snap, deltaRad, center);
					ctx.store.updateShape(childId, patch);
					updates.set(childId, patch);
					continue;
				}
				const childCx = snap.x + snap.width / 2;
				const childCy = snap.y + snap.height / 2;
				const rx = childCx - center.x;
				const ry = childCy - center.y;
				const newCx = center.x + rx * cos - ry * sin;
				const newCy = center.y + rx * sin + ry * cos;
				const childRotation = normalizeAngle(
					safeRotation(snap.rotation) + newRotation - startRotation,
				);
				const patch = {
					x: newCx - snap.width / 2,
					y: newCy - snap.height / 2,
					rotation: childRotation,
				};
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
				beforeSnapshots.set(childId, {
					x: snap.x,
					y: snap.y,
					rotation: safeRotation(snap.rotation),
				});
				afterSnapshots.set(childId, {
					x: child.x,
					y: child.y,
					rotation: safeRotation(child.rotation),
				});
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
				ctx.store.updateShape(childId, {
					x: snap.x,
					y: snap.y,
					rotation: safeRotation(snap.rotation),
				});
			}
		},
	};
}
