import type { ShapeData, ToolContext } from "@edv4h/usketch-shared";
import { getChildShapes } from "@edv4h/usketch-store";

const CONTAINER_TYPES: ReadonlySet<string> = new Set(["group", "frame", "island"]);

/** Default predicate: only containers (group/frame/island) follow with their children. */
const isContainer = (shape: ShapeData): boolean => CONTAINER_TYPES.has(shape.type);

export interface CollectDescendantsOptions {
	/**
	 * Decide whether a shape's children should be collected (and thus follow on
	 * move). Defaults to the container check (group/frame/island). Pass a custom
	 * predicate to also follow children of ordinary (non-container) parents —
	 * e.g. "a sticker attached via parentId to any shape should move with it".
	 */
	followChildrenOf?: (shape: ShapeData) => boolean;
}

/**
 * Collect the user-selected shapes plus all descendants of any shape whose
 * children should follow (containers by default). Used by drag and rotate
 * helpers so a parent moves/rotates with its children atomically.
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
	const follows = options.followChildrenOf ?? isContainer;
	const result = new Map<string, ShapeData>();
	const queue: string[] = [];

	for (const id of rootIds) {
		const shape = ctx.store.getShape(id);
		if (!shape || result.has(id)) continue;
		result.set(id, { ...shape });
		if (follows(shape)) queue.push(id);
	}

	while (queue.length > 0) {
		const parentId = queue.pop();
		if (!parentId) break;
		for (const child of getChildShapes(ctx.store, parentId)) {
			if (result.has(child.id)) continue;
			result.set(child.id, { ...child });
			if (follows(child)) queue.push(child.id);
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
