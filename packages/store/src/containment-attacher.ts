import type {
	BoardStore,
	CommandRegistry,
	ContainerAttachHit,
	EventBus,
	ShapeData,
} from "@edv4h/usketch-shared";
import { getShapeCorners, safeRotation, shapeBoxContainsPoint } from "@edv4h/usketch-shared";
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
	 * non-attach containers (e.g. group) and plain shapes may attach.
	 */
	canAttach?: (shape: ShapeData) => boolean;
	/**
	 * How much of a shape must be inside `container` for it to attach (and stay
	 * attached). Default: `"contain"` for every container. Typically
	 * registry-aware: `getContainerAttachHit(def, container)`.
	 */
	attachHit?: (container: ShapeData) => ContainerAttachHit;
	/**
	 * Whether `container` adopts `shape`. Default: always. Typically
	 * registry-aware: `containerAccepts(def, container, shape)`.
	 */
	accepts?: (container: ShapeData, shape: ShapeData) => boolean;
}

/** Container-specific rules {@link findAttachParent} applies to each candidate. */
export interface AttachParentRules {
	attachHit?: (container: ShapeData) => ContainerAttachHit;
	accepts?: (container: ShapeData, shape: ShapeData) => boolean;
}

const boundsOf = (s: ShapeData) => ({ x: s.x, y: s.y, width: s.width, height: s.height });

/**
 * Whether `shape` is inside `container` enough to be its child: wholly
 * (`"contain"`) or by its center (`"center"`). Both are compared where they are
 * drawn, so a rotated container (or shape) holds what lies inside its turned box.
 */
export function isInsideForAttach(
	container: ShapeData,
	shape: ShapeData,
	hit: ContainerAttachHit = "contain",
): boolean {
	if (hit === "center") {
		const center = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
		return shapeBoxContainsPoint(container, center);
	}
	if (safeRotation(container.rotation) === 0 && safeRotation(shape.rotation) === 0) {
		return containsAABB(boundsOf(container), boundsOf(shape));
	}
	return getShapeCorners(shape).every((corner) => shapeBoxContainsPoint(container, corner));
}

/**
 * The container {@link createContainmentAttacher} attaches `shape` to: the
 * smallest attach-target container that contains it (wholly, or by its center
 * for a container whose `rules.attachHit` is `"center"`) and accepts it (never
 * one of its own descendants), or null. `shape` may be a not-yet-added copy;
 * the store entry with its id, if any, is skipped.
 */
export function findAttachParent(
	store: BoardStore,
	shape: ShapeData,
	isAttachTarget: (shape: ShapeData) => boolean,
	rules: AttachParentRules = {},
): ShapeData | null {
	let best: ShapeData | null = null;
	for (const [id, candidate] of store.getShapes()) {
		if (id === shape.id) continue;
		if (!isAttachTarget(candidate)) continue;
		// Never nest a shape into one of its own descendants.
		if (wouldCreateCycle(store, shape.id, id)) continue;
		if (!isInsideForAttach(candidate, shape, rules.attachHit?.(candidate))) continue;
		if (rules.accepts && !rules.accepts(candidate, shape)) continue;
		if (!best || candidate.width * candidate.height < best.width * best.height) {
			best = candidate;
		}
	}
	return best;
}

/**
 * Wire up automatic parent-child attachment by containment. When a shape is
 * added or finishes a move, find the smallest attach-target container that
 * contains it (wholly by default, or by its center — see `attachHit`) and
 * accepts it, and set its `parentId` (or clear it when moved out).
 *
 * Generalizes the frame plugin's former bespoke `autoReparent` so any shape
 * whose definition opts in via `container.autoAttach` participates. Reuses
 * {@link containsAABB} and undo-able {@link createReparentCommand}.
 *
 * Returns a teardown function.
 */
export function createContainmentAttacher(opts: ContainmentAttacherOptions): () => void {
	const { store, commands, events, isAttachTarget } = opts;
	const rules: AttachParentRules = { attachHit: opts.attachHit, accepts: opts.accepts };
	const canAttach =
		opts.canAttach ?? ((s: ShapeData) => s.type !== "connector" && !isAttachTarget(s));

	function autoReparent(shapeId: string, keepContainingParent = false) {
		const shape = store.getShape(shapeId);
		if (!shape || !canAttach(shape)) return;

		// A shape added with a parentId (duplicate / paste) keeps that parent: an
		// attach-target parent (frame) while it still contains the shape — re-picking
		// would tie-break same-size containers (e.g. the original frame under its
		// copy) toward the wrong one — and any other parent (group) always, since
		// that membership is not decided by containment.
		if (keepContainingParent && typeof shape.parentId === "string") {
			const parent = store.getShape(shape.parentId);
			if (
				parent &&
				(!isAttachTarget(parent) ||
					(isInsideForAttach(parent, shape, rules.attachHit?.(parent)) &&
						(!rules.accepts || rules.accepts(parent, shape))))
			) {
				return;
			}
		}
		const best = findAttachParent(store, shape, isAttachTarget, rules);

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
		if (payload?.id) autoReparent(payload.id, true);
	});

	return () => {
		offMoveEnd();
		offAdded();
		for (const timer of pending) clearTimeout(timer);
		pending.clear();
	};
}
