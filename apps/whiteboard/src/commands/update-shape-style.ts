import type { Command, CommandContext, Shape, StyleProperties } from "@usketch/shared-types";
import { BaseCommand } from "@usketch/store/src/commands/base-command";

export class UpdateShapeStyleCommand extends BaseCommand {
	private previousStates: Map<string, Partial<StyleProperties>> = new Map();

	constructor(
		private shapeIds: string[],
		private styleUpdates: Partial<StyleProperties>,
	) {
		super("Update shape style");
	}

	execute(context: CommandContext): void {
		const state = context.getState();

		// Save previous states for undo
		this.shapeIds.forEach((id) => {
			const shape = state.shapes[id];
			if (!shape) return;

			const previousStyle: Partial<StyleProperties> = {};
			Object.keys(this.styleUpdates).forEach((key) => {
				const k = key as keyof StyleProperties;
				(previousStyle as any)[k] = shape[k];
			});
			this.previousStates.set(id, previousStyle);
		});

		// Apply updates
		context.setState((state) => {
			this.shapeIds.forEach((id) => {
				if (state.shapes[id]) {
					state.shapes[id] = {
						...state.shapes[id],
						...this.styleUpdates,
					} as Shape;
				}
			});
		});
	}

	undo(context: CommandContext): void {
		if (this.previousStates.size === 0) return;

		context.setState((state) => {
			this.previousStates.forEach((previousStyle, id) => {
				if (state.shapes[id]) {
					state.shapes[id] = {
						...state.shapes[id],
						...previousStyle,
					} as Shape;
				}
			});
		});
	}

	override canMerge(other: Command): boolean {
		if (!(other instanceof UpdateShapeStyleCommand)) return false;

		// Check if same shapes are being updated
		if (this.shapeIds.length !== other.shapeIds.length) return false;
		const thisSet = new Set(this.shapeIds);
		const otherSet = new Set(other.shapeIds);
		for (const id of thisSet) {
			if (!otherSet.has(id)) return false;
		}

		// Merge if updates are within 1 second
		const timeDiff = other.timestamp - this.timestamp;
		return timeDiff < 1000;
	}

	override merge(other: Command): Command {
		if (!(other instanceof UpdateShapeStyleCommand)) {
			throw new Error("Cannot merge with non-UpdateShapeStyleCommand");
		}

		// Create new command with merged updates
		const mergedCommand = new UpdateShapeStyleCommand(this.shapeIds, {
			...this.styleUpdates,
			...other.styleUpdates,
		});

		// Preserve the original previous states for proper undo
		if (this.previousStates.size > 0) {
			mergedCommand.previousStates = new Map(this.previousStates);
		}

		return mergedCommand;
	}
}
