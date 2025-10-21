import type { CommandContext, Shape } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

export class CreateShapeCommand extends BaseCommand {
	constructor(private shape: Shape) {
		super(`Create ${shape.type}`);
	}

	execute(context: CommandContext): void {
		context.setState((state) => {
			const store = state as any;

			// Add shape to shapes
			state.shapes[this.shape.id] = this.shape;

			// Add to zOrder (top of stack)
			if (!store.zOrder) {
				store.zOrder = [];
			}
			store.zOrder = [...store.zOrder, this.shape.id];
		});
	}

	undo(context: CommandContext): void {
		context.setState((state) => {
			const store = state as any;

			// Remove shape
			delete state.shapes[this.shape.id];
			state.selectedShapeIds.delete(this.shape.id);

			// Remove from zOrder
			if (store.zOrder) {
				store.zOrder = store.zOrder.filter((id: string) => id !== this.shape.id);
			}
		});
	}
}
