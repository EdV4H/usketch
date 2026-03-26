import type { BoardStore, Command, ShapeData } from "@edv4h/usketch-shared";

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
