import type { CommandContext, Shape } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

export class CreateShapeCommand extends BaseCommand {
	constructor(private shape: Shape) {
		super(`Create ${shape.type}`);
	}

	execute(context: CommandContext): void {
		context.setState((state) => {
			state.shapes[this.shape.id] = this.shape;
		});
	}

	undo(context: CommandContext): void {
		context.setState((state) => {
			delete state.shapes[this.shape.id];
			state.selectedShapeIds.delete(this.shape.id);
		});
	}
}
