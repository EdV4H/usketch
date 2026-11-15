// Every dashboard position write goes through here so an item's CHILDREN follow it.
//
// Grid items are top-level shapes (a frame / group / container is one item), but
// shape coordinates are absolute: writing only the parent's `x/y` leaves its
// children where they were, so「整列」/ reflow / drop-snap used to tear a frame
// away from its contents (and a group, whose bounds are recomputed from its
// children, snapped back on the next child edit). The select tool's drag moves the
// parent's followed descendants by the same delta; this mirrors that rule so a
// dashboard move looks exactly like the user dragging the item there.
import type { BoardStore, ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { isAttachableFollow, isShapeContainer } from "@edv4h/usketch-shared";

/** One item write: the patch applied to the item itself. When it changes `x`/`y`,
 *  the item's followed descendants are translated by the same delta. */
export type ItemPatch = { id: string; patch: Partial<Omit<ShapeData, "id">> };

/** Same follow rule as the select tool's drag (`collectSelectionWithDescendants`):
 *  a container's children follow it, and so does any child whose own definition
 *  opts in via `attachable.follow`. Without a registry (headless / tests) every
 *  child follows — there is no way to tell, and leaving them behind is the bug. */
function childFollows(
	registry: ShapeRegistry | undefined,
	parent: ShapeData,
	child: ShapeData,
): boolean {
	if (!registry) return true;
	return (
		isShapeContainer(registry.get(parent.type), parent) ||
		isAttachableFollow(registry.get(child.type), child)
	);
}

/** Translate patch for a descendant: the definition's `move` hook when it has one
 *  (absolute-coordinate fields like connector endpoints), else plain `x/y`. */
function translatePatch(
	registry: ShapeRegistry | undefined,
	shape: ShapeData,
	dx: number,
	dy: number,
): Partial<Omit<ShapeData, "id">> {
	const move = registry?.get(shape.type)?.move;
	if (move) return move(shape, dx, dy);
	return { x: shape.x + dx, y: shape.y + dy };
}

/** parentId → direct children, built in one pass over the store. */
function childIndex(store: BoardStore): Map<string, ShapeData[]> {
	const index = new Map<string, ShapeData[]>();
	for (const shape of store.getShapes().values()) {
		if (typeof shape.parentId !== "string") continue;
		const bucket = index.get(shape.parentId);
		if (bucket) bucket.push(shape);
		else index.set(shape.parentId, [shape]);
	}
	return index;
}

/** Ids of `root`'s followed descendants (parent before child), excluding `root`. */
function followedDescendants(
	registry: ShapeRegistry | undefined,
	index: ReadonlyMap<string, readonly ShapeData[]>,
	root: ShapeData,
): string[] {
	const out: string[] = [];
	const seen = new Set<string>([root.id]);
	const queue: ShapeData[] = [root];
	while (queue.length > 0) {
		const parent = queue.shift() as ShapeData;
		for (const child of index.get(parent.id) ?? []) {
			if (seen.has(child.id) || !childFollows(registry, parent, child)) continue;
			seen.add(child.id);
			out.push(child.id);
			queue.push(child);
		}
	}
	return out;
}

/**
 * Apply item patches, carrying each moved item's followed descendants along by
 * the item's own position delta (current → patched). Delta-based, so it is
 * correct in both directions: a command's execute and undo can each just call
 * this with their target positions and the children end up where they belong.
 * Patches that don't move the item (size only, or already in place) write as-is.
 */
export function applyItemPatches(
	store: BoardStore,
	registry: ShapeRegistry | undefined,
	patches: readonly ItemPatch[],
): void {
	let index: Map<string, ShapeData[]> | null = null;
	for (const { id, patch } of patches) {
		const cur = store.getShape(id);
		if (!cur) continue;
		const dx = (patch.x ?? cur.x) - cur.x;
		const dy = (patch.y ?? cur.y) - cur.y;
		// Resolve the subtree and every child's target BEFORE writing: listeners that
		// react to the writes (e.g. a group refitting its bounds to its children
		// mid-batch) must change neither who counts as a child nor where it goes.
		const childPatches: ItemPatch[] = [];
		if (dx !== 0 || dy !== 0) {
			index ??= childIndex(store);
			for (const childId of followedDescendants(registry, index, cur)) {
				const child = store.getShape(childId);
				if (child)
					childPatches.push({ id: childId, patch: translatePatch(registry, child, dx, dy) });
			}
		}
		store.updateShape(id, patch);
		for (const c of childPatches) store.updateShape(c.id, c.patch);
	}
}
