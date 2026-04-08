import type { BoardStore, Command, ShapeData } from "@edv4h/usketch-shared";
import { compareZIndex, zIndexBetween } from "@edv4h/usketch-shared";

export function createAddShapeCommand(store: BoardStore, shape: ShapeData): Command {
	return {
		execute() {
			store.addShape(shape);
		},
		undo() {
			store.deleteShape(shape.id);
		},
	};
}

export function createDeleteShapeCommand(store: BoardStore, shapeId: string): Command {
	let snapshot: ShapeData | undefined;
	return {
		execute() {
			snapshot = store.getShape(shapeId);
			store.deleteShape(shapeId);
		},
		undo() {
			if (snapshot) {
				store.addShape(snapshot);
			}
		},
	};
}

export function createMoveShapesCommand(
	store: BoardStore,
	beforeSnapshots: Map<string, ShapeData>,
	afterSnapshots: Map<string, ShapeData>,
): Command {
	return {
		execute() {
			for (const [id, after] of afterSnapshots) {
				store.updateShape(id, after);
			}
		},
		undo() {
			for (const [id, before] of beforeSnapshots) {
				store.updateShape(id, before);
			}
		},
	};
}

export function createUpdateShapeCommand(
	store: BoardStore,
	shapeId: string,
	from: Partial<ShapeData>,
	to: Partial<ShapeData>,
): Command {
	return {
		execute() {
			store.updateShape(shapeId, to);
		},
		undo() {
			store.updateShape(shapeId, from);
		},
	};
}

export function createBatchUpdateShapesCommand(
	store: BoardStore,
	updates: Array<{ id: string; from: Partial<ShapeData>; to: Partial<ShapeData> }>,
): Command {
	return {
		execute() {
			for (const { id, to } of updates) store.updateShape(id, to);
		},
		undo() {
			for (const { id, from } of updates) store.updateShape(id, from);
		},
	};
}

/** Create a group from selected shapes */
export function createGroupCommand(
	store: BoardStore,
	groupShape: ShapeData,
	childIds: string[],
): Command {
	const prevParentIds = new Map<string, unknown>();
	return {
		execute() {
			store.addShape(groupShape);
			for (const id of childIds) {
				const child = store.getShape(id);
				prevParentIds.set(id, child?.parentId);
				store.updateShape(id, { parentId: groupShape.id });
			}
		},
		undo() {
			for (const id of childIds) {
				const prev = prevParentIds.get(id);
				store.updateShape(id, { parentId: prev ?? undefined });
			}
			store.deleteShape(groupShape.id);
		},
	};
}

/** Ungroup: remove group shape and clear children's parentId */
export function createUngroupCommand(store: BoardStore, groupId: string): Command {
	let groupSnapshot: ShapeData | undefined;
	let childIds: string[] = [];
	return {
		execute() {
			groupSnapshot = store.getShape(groupId);
			childIds = [];
			for (const [, shape] of store.getShapes()) {
				if (shape.parentId === groupId) {
					childIds.push(shape.id);
				}
			}
			for (const id of childIds) {
				store.updateShape(id, { parentId: undefined });
			}
			store.deleteShape(groupId);
		},
		undo() {
			if (groupSnapshot) {
				store.addShape(groupSnapshot);
			}
			for (const id of childIds) {
				store.updateShape(id, { parentId: groupId });
			}
		},
	};
}

/** Move shapes to a new parent (frame) */
export function createReparentCommand(
	store: BoardStore,
	shapeIds: string[],
	newParentId: string | undefined,
): Command {
	const prevParentIds = new Map<string, unknown>();
	return {
		execute() {
			for (const id of shapeIds) {
				const shape = store.getShape(id);
				prevParentIds.set(id, shape?.parentId);
				store.updateShape(id, { parentId: newParentId ?? undefined });
			}
		},
		undo() {
			for (const id of shapeIds) {
				const prev = prevParentIds.get(id);
				store.updateShape(id, { parentId: prev ?? undefined });
			}
		},
	};
}

/** Delete a shape and all its children recursively */
export function createDeleteWithChildrenCommand(store: BoardStore, shapeId: string): Command {
	let deletedShapes: ShapeData[] = [];

	function collectDescendants(id: string): string[] {
		const ids = [id];
		for (const [, shape] of store.getShapes()) {
			if (shape.parentId === id) {
				ids.push(...collectDescendants(shape.id));
			}
		}
		return ids;
	}

	return {
		execute() {
			const allIds = collectDescendants(shapeId);
			// Also collect connectors attached to any of these shapes
			const connectorIds = new Set<string>();
			for (const [, shape] of store.getShapes()) {
				if (
					shape.type === "connector" &&
					(allIds.includes(shape.sourceId as string) || allIds.includes(shape.targetId as string))
				) {
					connectorIds.add(shape.id);
				}
			}
			const toDelete = [...new Set([...allIds, ...connectorIds])];
			deletedShapes = [];
			for (const id of toDelete) {
				const snap = store.getShape(id);
				if (snap) deletedShapes.push(snap);
			}
			// Delete children first, then parents
			for (const snap of [...deletedShapes].reverse()) {
				store.deleteShape(snap.id);
			}
		},
		undo() {
			// Restore in original order (parents first)
			for (const snap of deletedShapes) {
				store.addShape(snap);
			}
		},
	};
}

// ─── z-order commands ───────────────────────────────────────────────────────

const NOOP_COMMAND: Command = {
	execute() {},
	undo() {},
};

/** Return shapes in the same sibling group (same parentId), sorted by zIndex. */
function getSiblings(store: BoardStore, shape: ShapeData): ShapeData[] {
	const parent = shape.parentId ?? null;
	return store.getShapesSorted().filter((s) => (s.parentId ?? null) === parent);
}

/** Move a single shape to the front of its sibling group. */
export function createBringToFrontCommand(store: BoardStore, shapeId: string): Command {
	const shape = store.getShape(shapeId);
	if (!shape) return NOOP_COMMAND;
	const siblings = getSiblings(store, shape).filter((s) => s.id !== shapeId);
	if (siblings.length === 0) return NOOP_COMMAND;
	const topKey = siblings[siblings.length - 1]?.zIndex ?? null;
	if (topKey === null) return NOOP_COMMAND;
	// Already at front?
	if (shape.zIndex && compareZIndex(shape.zIndex, topKey) > 0) return NOOP_COMMAND;
	const newKey = zIndexBetween(topKey, null);
	return createUpdateShapeCommand(store, shapeId, { zIndex: shape.zIndex }, { zIndex: newKey });
}

/** Move a single shape to the back of its sibling group. */
export function createSendToBackCommand(store: BoardStore, shapeId: string): Command {
	const shape = store.getShape(shapeId);
	if (!shape) return NOOP_COMMAND;
	const siblings = getSiblings(store, shape).filter((s) => s.id !== shapeId);
	if (siblings.length === 0) return NOOP_COMMAND;
	const bottomKey = siblings[0]?.zIndex ?? null;
	if (bottomKey === null) return NOOP_COMMAND;
	if (shape.zIndex && compareZIndex(shape.zIndex, bottomKey) < 0) return NOOP_COMMAND;
	const newKey = zIndexBetween(null, bottomKey);
	return createUpdateShapeCommand(store, shapeId, { zIndex: shape.zIndex }, { zIndex: newKey });
}

/** Move a single shape one step toward the front within its sibling group. */
export function createBringForwardCommand(store: BoardStore, shapeId: string): Command {
	const shape = store.getShape(shapeId);
	if (!shape) return NOOP_COMMAND;
	const siblings = getSiblings(store, shape);
	const index = siblings.findIndex((s) => s.id === shapeId);
	if (index < 0 || index === siblings.length - 1) return NOOP_COMMAND;
	const above = siblings[index + 1];
	if (!above) return NOOP_COMMAND;
	const aboveAbove = siblings[index + 2];
	const newKey = zIndexBetween(above.zIndex ?? null, aboveAbove?.zIndex ?? null);
	return createUpdateShapeCommand(store, shapeId, { zIndex: shape.zIndex }, { zIndex: newKey });
}

/** Move a single shape one step toward the back within its sibling group. */
export function createSendBackwardCommand(store: BoardStore, shapeId: string): Command {
	const shape = store.getShape(shapeId);
	if (!shape) return NOOP_COMMAND;
	const siblings = getSiblings(store, shape);
	const index = siblings.findIndex((s) => s.id === shapeId);
	if (index <= 0) return NOOP_COMMAND;
	const below = siblings[index - 1];
	if (!below) return NOOP_COMMAND;
	const belowBelow = siblings[index - 2];
	const newKey = zIndexBetween(belowBelow?.zIndex ?? null, below.zIndex ?? null);
	return createUpdateShapeCommand(store, shapeId, { zIndex: shape.zIndex }, { zIndex: newKey });
}

/**
 * Move a selection of shapes to the front, preserving their relative z-order.
 * Shapes from different parentId groups are moved independently within their own group.
 */
export function createBringSelectionToFrontCommand(
	store: BoardStore,
	shapeIds: readonly string[],
): Command {
	const updates = computeBringSelectionToFrontUpdates(store, shapeIds);
	if (updates.length === 0) return NOOP_COMMAND;
	return createBatchUpdateShapesCommand(store, updates);
}

/**
 * Move a selection of shapes to the back, preserving their relative z-order.
 */
export function createSendSelectionToBackCommand(
	store: BoardStore,
	shapeIds: readonly string[],
): Command {
	const updates = computeSendSelectionToBackUpdates(store, shapeIds);
	if (updates.length === 0) return NOOP_COMMAND;
	return createBatchUpdateShapesCommand(store, updates);
}

interface SiblingGroup {
	/** All shapes sharing this parentId, in zIndex ascending order. */
	siblings: ShapeData[];
	/** Subset of siblings that are selected, in zIndex ascending order. */
	selected: ShapeData[];
	/** Subset of siblings that are NOT selected, in zIndex ascending order. */
	unselected: ShapeData[];
}

function parentKey(shape: ShapeData): string | null {
	return (shape.parentId as string | undefined) ?? null;
}

/**
 * Group shapes by parentId in a single pass over the sorted array. For each
 * parent, emit the full sibling list along with selected/unselected subsets.
 * All three arrays preserve the input zIndex ascending order.
 */
function groupByParentForSelection(
	sorted: readonly ShapeData[],
	idSet: ReadonlySet<string>,
): Map<string | null, SiblingGroup> {
	const byParent = new Map<string | null, SiblingGroup>();
	for (const shape of sorted) {
		const parent = parentKey(shape);
		let group = byParent.get(parent);
		if (!group) {
			group = { siblings: [], selected: [], unselected: [] };
			byParent.set(parent, group);
		}
		group.siblings.push(shape);
		if (idSet.has(shape.id)) group.selected.push(shape);
		else group.unselected.push(shape);
	}
	// Drop parents with no selected shapes so callers can iterate directly
	for (const [parent, group] of byParent) {
		if (group.selected.length === 0) byParent.delete(parent);
	}
	return byParent;
}

function computeBringSelectionToFrontUpdates(
	store: BoardStore,
	shapeIds: readonly string[],
): Array<{ id: string; from: Partial<ShapeData>; to: Partial<ShapeData> }> {
	const idSet = new Set(shapeIds);
	const byParent = groupByParentForSelection(store.getShapesSorted(), idSet);

	const updates: Array<{
		id: string;
		from: Partial<ShapeData>;
		to: Partial<ShapeData>;
	}> = [];
	for (const { selected, unselected } of byParent.values()) {
		let lastKey: string | null = unselected[unselected.length - 1]?.zIndex ?? null;
		// `selected` is already in zIndex ascending order; assign new keys in that order
		for (const shape of selected) {
			const newKey = zIndexBetween(lastKey, null);
			updates.push({
				id: shape.id,
				from: { zIndex: shape.zIndex },
				to: { zIndex: newKey },
			});
			lastKey = newKey;
		}
	}
	return updates;
}

function computeSendSelectionToBackUpdates(
	store: BoardStore,
	shapeIds: readonly string[],
): Array<{ id: string; from: Partial<ShapeData>; to: Partial<ShapeData> }> {
	const idSet = new Set(shapeIds);
	const byParent = groupByParentForSelection(store.getShapesSorted(), idSet);

	const updates: Array<{
		id: string;
		from: Partial<ShapeData>;
		to: Partial<ShapeData>;
	}> = [];
	for (const { selected, unselected } of byParent.values()) {
		const upperKey: string | null = unselected[0]?.zIndex ?? null;
		// Assign keys in reverse order so the last-assigned key ends up just below upperKey
		// while preserving relative order among selected shapes.
		const newKeys: string[] = [];
		let currentUpper = upperKey;
		for (let i = selected.length - 1; i >= 0; i--) {
			const newKey = zIndexBetween(null, currentUpper);
			newKeys.unshift(newKey);
			currentUpper = newKey;
		}
		for (let i = 0; i < selected.length; i++) {
			const shape = selected[i];
			const newKey = newKeys[i];
			if (!shape || !newKey) continue;
			updates.push({
				id: shape.id,
				from: { zIndex: shape.zIndex },
				to: { zIndex: newKey },
			});
		}
	}
	return updates;
}
