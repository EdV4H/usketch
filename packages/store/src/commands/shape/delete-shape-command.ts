import type { CommandContext, Shape } from "@usketch/shared-types";
import { whiteboardStore } from "../../store";
import { BaseCommand } from "../base-command";

export class DeleteShapeCommand extends BaseCommand {
	private deletedShape?: Shape;
	private wasSelected: boolean = false;
	private previousZOrderIndex: number = -1;

	constructor(private shapeId: string) {
		super("Delete shape");
	}

	execute(context: CommandContext): void {
		const state = context.getState();
		const shape = state.shapes[this.shapeId];
		if (shape) {
			this.deletedShape = shape;
		}
		this.wasSelected = state.selectedShapeIds.has(this.shapeId);

		// Save zOrder index for undo
		const fullStore = whiteboardStore.getState();
		this.previousZOrderIndex = fullStore.zOrder?.indexOf(this.shapeId) ?? -1;

		context.setState((state) => {
			const store = state as any;

			// Remove shape
			delete state.shapes[this.shapeId];
			state.selectedShapeIds.delete(this.shapeId);

			// Remove from zOrder
			if (store.zOrder) {
				store.zOrder = store.zOrder.filter((id: string) => id !== this.shapeId);
			}
		});
	}

	undo(context: CommandContext): void {
		if (this.deletedShape) {
			const shape = this.deletedShape;
			context.setState((state) => {
				const store = state as any;

				// Restore shape
				state.shapes[this.shapeId] = shape;
				if (this.wasSelected) {
					state.selectedShapeIds.add(this.shapeId);
				}

				// Restore zOrder at previous position
				if (!store.zOrder) {
					store.zOrder = [];
				}
				if (this.previousZOrderIndex >= 0) {
					const newZOrder = [...store.zOrder];
					newZOrder.splice(this.previousZOrderIndex, 0, this.shapeId);
					store.zOrder = newZOrder;
				} else {
					// If index was not found, add to end
					store.zOrder = [...store.zOrder, this.shapeId];
				}
			});
		}
	}
}
