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
