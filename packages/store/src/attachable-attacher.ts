import type { BoardStore, CommandRegistry, EventBus, ShapeData } from "@edv4h/usketch-shared";
import { createReparentCommand } from "./commands.js";
import { isInsideForAttach } from "./containment-attacher.js";
import { wouldCreateCycle } from "./hierarchy-utils.js";

/**
 * Resolved attach behavior for a candidate child shape, or `null` if the shape
 * is not an attachable child. Built by the caller (typically registry-aware via
 * the shared `attachable.*` resolvers).
 */
export interface AttachableResolution {
	/** Whether the child may attach to the given target (type filter, self/connector exclusion, …). */
	accepts: (target: ShapeData) => boolean;
	/** How the target is detected: center point in bounds, or full containment. */
	hitTest: "center" | "contain";
}

export interface AttachableAttacherOptions {
	store: BoardStore;
	commands: CommandRegistry;
	events: EventBus;
	/**
	 * Resolve a shape's attachable behavior, or `null` for non-attachable shapes.
	 * Called for each shape reported by `shapes:move-end`.
	 */
	resolve: (shape: ShapeData) => AttachableResolution | null;
}

/**
 * Wire up child-driven attachment: when an attachable shape finishes a move,
 * find the front-most shape it accepts (by center-point or full-containment hit
 * test) and set its `parentId` — or clear it when dropped over nothing.
 *
 * The child-side counterpart to {@link createContainmentAttacher}: attachment is
 * decided by the *child's* declaration (`attachable`), so any shape — even a
 * non-container — can become a parent. Reuses {@link createReparentCommand}
 * (undoable, Yjs-synced) and {@link wouldCreateCycle}.
 *
 * Returns a teardown function.
 */
export function createAttachableAttacher(opts: AttachableAttacherOptions): () => void {
	const { store, commands, events, resolve } = opts;

	function autoReparent(shapeId: string, sorted: readonly ShapeData[]) {
		const shape = store.getShape(shapeId);
		if (!shape) return;
		const resolution = resolve(shape);
		if (!resolution) return;

		// Front-most accepted target under the child wins (mirrors picking the
		// topmost shape on a drop). `sorted` is back→front, so iterate in reverse.
		let target: ShapeData | undefined;
		for (let i = sorted.length - 1; i >= 0; i--) {
			const candidate = sorted[i];
			if (!candidate || candidate.id === shapeId) continue;
			if (!resolution.accepts(candidate)) continue;
			// Never nest a shape into one of its own descendants.
			if (wouldCreateCycle(store, shapeId, candidate.id)) continue;
			// Rotation-aware (a sticker on a rotated shape lands where the shape is drawn).
			const hit = isInsideForAttach(candidate, shape, resolution.hitTest);
			if (hit) {
				target = candidate;
				break;
			}
		}

		const currentParentId = shape.parentId as string | undefined;
		const newParentId = target?.id;
		if (currentParentId !== newParentId) {
			commands.execute(createReparentCommand(store, [shapeId], newParentId ?? undefined));
		}
	}

	// Pending deferred reparents, so teardown can cancel any that haven't fired.
	const pending = new Set<ReturnType<typeof setTimeout>>();

	// On move-end (emitted by the select tool after a move command commits).
	// Deferred so reparent runs after the current render/microtask cycle — the
	// same ordering the containment attacher relies on.
	const offMoveEnd = events.on<{ shapeIds: string[] }>("shapes:move-end", (data) => {
		if (!data?.shapeIds) return;
		const timer = setTimeout(() => {
			pending.delete(timer);
			// Sort once for the whole batch: reparenting sets only `parentId`, which
			// doesn't affect z-order or geometry, so the array stays valid across all
			// shapeIds — avoids re-sorting the board per moved shape.
			const sorted = store.getShapesSorted();
			for (const shapeId of data.shapeIds) autoReparent(shapeId, sorted);
		}, 0);
		pending.add(timer);
	});

	return () => {
		offMoveEnd();
		for (const timer of pending) clearTimeout(timer);
		pending.clear();
	};
}
