import type { BoardStore, CommandRegistry, EventBus, ShapeData } from "@edv4h/usketch-shared";
import { containsAABB } from "./collision-utils.js";
import { createReparentCommand } from "./commands.js";
import { wouldCreateCycle } from "./hierarchy-utils.js";

export interface ContainmentAttacherOptions {
	store: BoardStore;
	commands: CommandRegistry;
	events: EventBus;
	/**
	 * Whether a shape can act as an auto-attach container (evaluated per
	 * candidate). Typically registry-aware: `isContainerAutoAttach(def, shape)`.
	 */
	isAttachTarget: (shape: ShapeData) => boolean;
	/**
	 * Whether a shape is eligible to be auto-attached as a child. Default:
	 * anything that isn't a connector and isn't itself an attach-target — so
	 * attach-target containers (e.g. frames) stay top-level and don't nest, while
	 * non-attach containers (island/group) and plain shapes may attach.
	 */
	canAttach?: (shape: ShapeData) => boolean;
}

const boundsOf = (s: ShapeData) => ({ x: s.x, y: s.y, width: s.width, height: s.height });

/**
 * Wire up automatic parent-child attachment by containment. When a shape is
 * added or finishes a move, find the smallest attach-target container that
 * fully contains it and set its `parentId` (or clear it when moved out).
 *
 * Generalizes the frame plugin's former bespoke `autoReparent` so any shape
 * whose definition opts in via `container.autoAttach` participates. Reuses
 * {@link containsAABB} and undo-able {@link createReparentCommand}.
 *
 * Returns a teardown function.
 */
export function createContainmentAttacher(opts: ContainmentAttacherOptions): () => void {
	const { store, commands, events, isAttachTarget } = opts;
	const canAttach =
		opts.canAttach ?? ((s: ShapeData) => s.type !== "connector" && !isAttachTarget(s));

	function autoReparent(shapeId: string) {
		const shape = store.getShape(shapeId);
		if (!shape || !canAttach(shape)) return;

		const shapeBounds = boundsOf(shape);
		// Find the smallest attach-target container that fully contains the shape.
		let best: ShapeData | null = null;
		for (const [id, candidate] of store.getShapes()) {
			if (id === shapeId) continue;
			if (!isAttachTarget(candidate)) continue;
			// Never nest a shape into one of its own descendants.
			if (wouldCreateCycle(store, shapeId, id)) continue;
			if (!containsAABB(boundsOf(candidate), shapeBounds)) continue;
			if (!best || candidate.width * candidate.height < best.width * best.height) {
				best = candidate;
			}
		}

		const currentParentId = shape.parentId as string | undefined;
		const newParentId = best?.id;
		if (currentParentId !== newParentId) {
			commands.execute(createReparentCommand(store, [shapeId], newParentId ?? undefined));
		}
	}

	// Pending deferred reparents, so teardown can cancel any that haven't fired.
	const pending = new Set<ReturnType<typeof setTimeout>>();

	// On move-end (emitted by the select tool after a move command commits).
	// Deferred so reparent runs after the current render/microtask cycle.
	const offMoveEnd = events.on<{ shapeIds: string[] }>("shapes:move-end", (data) => {
		if (!data?.shapeIds) return;
		const timer = setTimeout(() => {
			pending.delete(timer);
			for (const shapeId of data.shapeIds) autoReparent(shapeId);
		}, 0);
		pending.add(timer);
	});

	// On shape:added (e.g. drawing a shape inside a container).
	const offAdded = store.onMutation((event) => {
		if (event.type !== "shape:added") return;
		const payload = event.payload as { id?: string } | undefined;
		if (payload?.id) autoReparent(payload.id);
	});

	return () => {
		offMoveEnd();
		offAdded();
		for (const timer of pending) clearTimeout(timer);
		pending.clear();
	};
}
