import type { CommandContext } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

export class DeselectShapeCommand extends BaseCommand {
	private wasSelected = false;

	constructor(private shapeId: string) {
		super(`Deselect shape ${shapeId}`);
	}

	execute(context: CommandContext): void {
		const state = context.getState();
		this.wasSelected = state.selectedShapeIds.has(this.shapeId);

		if (this.wasSelected) {
			context.setState((state) => {
				const newSelection = new Set(state.selectedShapeIds);
				newSelection.delete(this.shapeId);
				state.selectedShapeIds = newSelection;
			});
		}
	}

	undo(context: CommandContext): void {
		if (this.wasSelected) {
			context.setState((state) => {
				state.selectedShapeIds = new Set([...state.selectedShapeIds, this.shapeId]);
			});
		}
	}
}
