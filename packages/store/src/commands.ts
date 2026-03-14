import type { BoardStore, Command, ShapeData } from "@usketch/shared";

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
	shapeIds: string[],
	dx: number,
	dy: number,
): Command {
	return {
		execute() {
			for (const id of shapeIds) {
				const shape = store.getShape(id);
				if (shape) {
					store.updateShape(id, { x: shape.x + dx, y: shape.y + dy });
				}
			}
		},
		undo() {
			for (const id of shapeIds) {
				const shape = store.getShape(id);
				if (shape) {
					store.updateShape(id, { x: shape.x - dx, y: shape.y - dy });
				}
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
