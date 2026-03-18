import type { BoardStore, Command, ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";

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
	shapes: ShapeRegistry,
	shapeIds: string[],
	dx: number,
	dy: number,
): Command {
	let snapshots: Map<string, ShapeData>;
	return {
		execute() {
			snapshots = new Map();
			for (const id of shapeIds) {
				const shape = store.getShape(id);
				if (!shape) continue;
				snapshots.set(id, { ...shape });
				const def = shapes.get(shape.type);
				const updates = def?.move ? def.move(shape, dx, dy) : { x: shape.x + dx, y: shape.y + dy };
				store.updateShape(id, updates);
			}
		},
		undo() {
			for (const [id, snap] of snapshots) {
				store.updateShape(id, snap);
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
