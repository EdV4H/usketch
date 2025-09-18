import type { Command, CommandContext, Shape } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

export class UpdateShapeCommand extends BaseCommand {
	private previousState?: Partial<Shape>;

	constructor(
		private shapeId: string,
		private updates: Partial<Shape>,
	) {
		super("Update shape");
	}

	execute(context: CommandContext): void {
		const state = context.getState();
		const shape = state.shapes[this.shapeId];

		if (!shape) return;

		// Save previous state for undo
		this.previousState = {};
		Object.keys(this.updates).forEach((key) => {
			const k = key as keyof Shape;
			(this.previousState as any)[k] = shape[k];
		});

		context.setState((state) => {
			state.shapes[this.shapeId] = {
				...state.shapes[this.shapeId],
				...this.updates,
			} as Shape;
		});
	}

	undo(context: CommandContext): void {
		if (this.previousState) {
			context.setState((state) => {
				state.shapes[this.shapeId] = {
					...state.shapes[this.shapeId],
					...this.previousState,
				} as Shape;
			});
		}
	}

	override canMerge(other: Command): boolean {
		if (!(other instanceof UpdateShapeCommand)) return false;
		if (this.shapeId !== other.shapeId) return false;

		// Merge if updates are within 1 second
		const timeDiff = other.timestamp - this.timestamp;
		return timeDiff < 1000;
	}

	override merge(other: Command): Command {
		if (!(other instanceof UpdateShapeCommand)) {
			throw new Error("Cannot merge with non-UpdateShapeCommand");
		}

		// Create new command with merged updates
		// The new command's updates should override the old ones
		const mergedCommand = new UpdateShapeCommand(this.shapeId, {
			...this.updates,
			...other.updates,
		});

		// Preserve the original previous state from the first command for proper undo
		// This ensures that undo will revert to the state before any updates
		if (this.previousState) {
			mergedCommand.previousState = this.previousState;
		}

		return mergedCommand;
	}
}
