// One undoable command for a whole scatter: spawn new shapes + move existing ones.
// `execute()` is IDEMPOTENT (add-or-update on new shapes) so the animated path can
// pre-apply raw writes during the tween and this command re-asserts the identical
// final state exactly once in history. Moving/adding fires shape:updated/added, so
// connector reroute + container layout happen automatically.
import type { BoardStore, Command, ShapeData } from "@edv4h/usketch-shared";

/** ShapeData without the immutable `id` — the patch shape `updateShape` accepts. */
function withoutId(shape: ShapeData): Partial<Omit<ShapeData, "id">> {
	const { id: _id, ...rest } = shape;
	return rest;
}

export function createScatterCommand(
	store: BoardStore,
	newShapes: ShapeData[],
	existingBefore: Map<string, ShapeData>,
	existingAfter: Map<string, Partial<Omit<ShapeData, "id">>>,
): Command {
	return {
		execute() {
			for (const shape of newShapes) {
				if (store.getShape(shape.id)) store.updateShape(shape.id, withoutId(shape));
				else store.addShape(shape);
			}
			for (const [id, patch] of existingAfter) store.updateShape(id, patch);
		},
		undo() {
			for (const shape of newShapes) store.deleteShape(shape.id);
			for (const [id, before] of existingBefore) store.updateShape(id, withoutId(before));
		},
	};
}
