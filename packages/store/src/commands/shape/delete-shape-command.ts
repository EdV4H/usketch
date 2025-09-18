import type { CommandContext, Shape } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

export class DeleteShapeCommand extends BaseCommand {
	private deletedShape?: Shape;
	private wasSelected: boolean = false;

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

		context.setState((state) => {
			delete state.shapes[this.shapeId];
			state.selectedShapeIds.delete(this.shapeId);
		});
	}

	undo(context: CommandContext): void {
		if (this.deletedShape) {
			const shape = this.deletedShape;
			context.setState((state) => {
				state.shapes[this.shapeId] = shape;
				if (this.wasSelected) {
					state.selectedShapeIds.add(this.shapeId);
				}
			});
		}
	}
}
