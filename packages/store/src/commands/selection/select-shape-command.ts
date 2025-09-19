import type { CommandContext } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

export class SelectShapeCommand extends BaseCommand {
	private previousSelection: Set<string> | null = null;

	constructor(private shapeId: string) {
		super(`Select shape ${shapeId}`);
	}

	execute(context: CommandContext): void {
		const state = context.getState();
		// Save previous selection for undo
		this.previousSelection = new Set(state.selectedShapeIds);

		context.setState((state) => {
			state.selectedShapeIds = new Set([...state.selectedShapeIds, this.shapeId]);
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
