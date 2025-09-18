import type { CommandContext } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

export class SetSelectionCommand extends BaseCommand {
	private previousSelection: Set<string> | null = null;

	constructor(private shapeIds: string[]) {
		super(`Set selection to ${shapeIds.length} shapes`);
	}

	execute(context: CommandContext): void {
		const state = context.getState();
		// Save previous selection for undo
		this.previousSelection = new Set(state.selectedShapeIds);

		context.setState((state) => {
			state.selectedShapeIds = new Set(this.shapeIds);
		});
	}

	undo(context: CommandContext): void {
		if (this.previousSelection !== null) {
			context.setState((state) => {
				state.selectedShapeIds = new Set(this.previousSelection);
			});
		}
	}
}
