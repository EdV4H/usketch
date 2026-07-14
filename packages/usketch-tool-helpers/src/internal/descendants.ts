import type { ShapeData, ToolContext } from "@edv4h/usketch-shared";
import { isAttachableFollow, isShapeContainer } from "@edv4h/usketch-shared";
import { getChildShapes } from "@edv4h/usketch-store";

export interface CollectDescendantsOptions {
	/**
	 * Decide whether a shape's children should be collected (and thus follow on
	 * move). Defaults to the container check (any shape whose registered
	 * definition marks it as a container — see {@link isShapeContainer}). Pass a
	 * custom predicate to also follow children of ordinary (non-container)
	 * parents.
	 *
	 * Note: independently of this predicate, any child whose own definition
	 * declares `attachable.follow` (see {@link isAttachableFollow}) always follows
	 * its parent — that is the child-side opt-in for "a sticker attached via
	 * parentId to any shape should move with it", and needs no parent cooperation.
	 */
	followChildrenOf?: (shape: ShapeData) => boolean;
}

/**
 * Cheap check over registered shape *definitions* (bounded by the number of
 * shape types, not the number of shapes on the board): does any type opt in as
 * an attachable-follow child? A `follow` that is a predicate is treated as a
 * possible `true`; only an explicit `follow: false` is ruled out. Lets callers
 * skip a whole-store scan on boards that don't use `attachable`.
 */
function registryDeclaresAttachableFollow(ctx: ToolContext): boolean {
	for (const def of ctx.shapes.getAll().values()) {
		if (def.attachable && def.attachable.follow !== false) return true;
	}
	return false;
}

/**
 * Collect the user-selected shapes plus all descendants of any shape whose
 * children should follow (containers by default). Used by the drag/move
 * helper (`startDragSession`) so a parent moves with its children atomically.
 * Rotation uses {@link collectChildrenOnly} instead, since it tracks the root
 * rotation separately from its children.
 *
 * Returns a Map of `shapeId -> snapshot at session start`. Snapshots are
 * shallow clones so callers can compare against later store state without
 * worrying about aliasing.
 */
export function collectSelectionWithDescendants(
	ctx: ToolContext,
	rootIds: Iterable<string>,
	options: CollectDescendantsOptions = {},
): Map<string, ShapeData> {
	const parentFollows =
		options.followChildrenOf ??
		((shape: ShapeData) => isShapeContainer(ctx.shapes.get(shape.type), shape));
	const childFollows = (shape: ShapeData) => isAttachableFollow(ctx.shapes.get(shape.type), shape);

	// Parents of `attachable.follow` children — so a non-container parent's
	// children are inspected only when at least one of them opts in. Guarded by a
	// cheap registry check (O(registered types), not O(shapes)): if no registered
	// definition declares `attachable.follow`, the whole-store scan is skipped and
	// starting a drag costs exactly what it did before this feature.
	const attachFollowParents = new Set<string>();
	if (registryDeclaresAttachableFollow(ctx)) {
		for (const shape of ctx.store.getShapes().values()) {
			if (shape.parentId && childFollows(shape)) attachFollowParents.add(shape.parentId);
		}
	}

	const result = new Map<string, ShapeData>();
	const queue: string[] = [];

	const enqueueIfDescends = (shape: ShapeData) => {
		// Descend into a shape's children when it is a followed parent (container or
		// custom predicate) or holds at least one attachable-follow child.
		if (parentFollows(shape) || attachFollowParents.has(shape.id)) queue.push(shape.id);
	};

	for (const id of rootIds) {
		const shape = ctx.store.getShape(id);
		if (!shape || result.has(id)) continue;
		result.set(id, { ...shape });
		enqueueIfDescends(shape);
	}

	while (queue.length > 0) {
		const parentId = queue.pop();
		if (!parentId) break;
		const parent = ctx.store.getShape(parentId);
		const parentIsFollowed = parent ? parentFollows(parent) : false;
		for (const child of getChildShapes(ctx.store, parentId)) {
			if (result.has(child.id)) continue;
			// Include a child when its parent propagates to all children (container),
			// or the child itself opts in via `attachable.follow`.
			if (!parentIsFollowed && !childFollows(child)) continue;
			result.set(child.id, { ...child });
			enqueueIfDescends(child);
		}
	}

	return result;
}

/**
 * Like {@link collectSelectionWithDescendants}, but only the *children* of
 * the given container (one level down through `getChildShapes`, recursive
 * via container detection). Intentionally doesn't include the root itself —
 * used by {@link startRotateSession} where the root rotation is tracked
 * separately from its rotated children.
 */
export function collectChildrenOnly(ctx: ToolContext, rootId: string): Map<string, ShapeData> {
	const result = new Map<string, ShapeData>();
	const root = ctx.store.getShape(rootId);
	if (!root || !isShapeContainer(ctx.shapes.get(root.type), root)) return result;

	const queue: string[] = [rootId];
	while (queue.length > 0) {
		const parentId = queue.pop();
		if (!parentId) break;
		for (const child of getChildShapes(ctx.store, parentId)) {
			if (result.has(child.id)) continue;
			result.set(child.id, { ...child });
			if (isShapeContainer(ctx.shapes.get(child.type), child)) queue.push(child.id);
		}
	}
	return result;
}
