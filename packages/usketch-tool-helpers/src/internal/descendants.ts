import type { ShapeData, ToolContext } from "@edv4h/usketch-shared";
import { getChildShapes } from "@edv4h/usketch-store";

const CONTAINER_TYPES: ReadonlySet<string> = new Set(["group", "frame", "island"]);

/**
 * Collect the user-selected shapes plus all descendants of any container
 * (group/frame/island) in the selection. Used by drag and rotate helpers so a
 * container moves/rotates with its children atomically.
 *
 * Returns a Map of `shapeId -> snapshot at session start`. Snapshots are
 * shallow clones so callers can compare against later store state without
 * worrying about aliasing.
 */
export function collectSelectionWithDescendants(
	ctx: ToolContext,
	rootIds: Iterable<string>,
): Map<string, ShapeData> {
	const result = new Map<string, ShapeData>();
	const queue: string[] = [];

	for (const id of rootIds) {
		const shape = ctx.store.getShape(id);
		if (!shape || result.has(id)) continue;
		result.set(id, { ...shape });
		if (CONTAINER_TYPES.has(shape.type)) queue.push(id);
	}

	while (queue.length > 0) {
		const parentId = queue.pop();
		if (!parentId) break;
		for (const child of getChildShapes(ctx.store, parentId)) {
			if (result.has(child.id)) continue;
			result.set(child.id, { ...child });
			if (CONTAINER_TYPES.has(child.type)) queue.push(child.id);
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
	if (!root || !CONTAINER_TYPES.has(root.type)) return result;

	const queue: string[] = [rootId];
	while (queue.length > 0) {
		const parentId = queue.pop();
		if (!parentId) break;
		for (const child of getChildShapes(ctx.store, parentId)) {
			if (result.has(child.id)) continue;
			result.set(child.id, { ...child });
			if (CONTAINER_TYPES.has(child.type)) queue.push(child.id);
		}
	}
	return result;
}
