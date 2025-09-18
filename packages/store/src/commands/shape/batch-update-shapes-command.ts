import type { Command, CommandContext, Shape } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

export interface ShapeUpdate {
	id: string;
	updates: Partial<Shape>;
}

export class BatchUpdateShapesCommand extends BaseCommand {
	private previousStates: Map<string, Shape> = new Map();

	constructor(
		private updates: ShapeUpdate[],
		description = "Batch update shapes",
	) {
		super(description);
	}

	execute(context: CommandContext): void {
		// Save previous states
		this.previousStates.clear();
		const state = context.getState();
		for (const update of this.updates) {
			const currentShape = state.shapes[update.id];
			if (currentShape) {
				this.previousStates.set(update.id, { ...currentShape });
			}
		}

		// Apply updates
		context.setState((state) => {
			const newShapes = { ...state.shapes };
			for (const update of this.updates) {
				if (newShapes[update.id]) {
					newShapes[update.id] = { ...newShapes[update.id], ...update.updates } as Shape;
				}
			}
			state.shapes = newShapes;
		});
	}

	undo(context: CommandContext): void {
		// Restore previous states
		context.setState((state) => {
			const newShapes = { ...state.shapes };
			for (const [id, previousShape] of this.previousStates.entries()) {
				newShapes[id] = previousShape;
			}
			state.shapes = newShapes;
		});
	}

	// Enable merging for consecutive batch updates
	override canMerge(other: Command): boolean {
		if (!(other instanceof BatchUpdateShapesCommand)) return false;

		// Check if both commands update the same set of shapes
		const thisIds = new Set(this.updates.map((u) => u.id));
		const otherIds = new Set(other.updates.map((u) => u.id));

		if (thisIds.size !== otherIds.size) return false;

		for (const id of thisIds) {
			if (!otherIds.has(id)) return false;
		}

		// Check if they're updating the same properties (e.g., only position)
		const thisProps = new Set(this.updates.flatMap((u) => Object.keys(u.updates)));
		const otherProps = new Set(other.updates.flatMap((u) => Object.keys(u.updates)));

		// Only merge if they're updating position-related properties
		const positionProps = new Set(["x", "y"]);
		for (const prop of thisProps) {
			if (!positionProps.has(prop)) return false;
		}
		for (const prop of otherProps) {
			if (!positionProps.has(prop)) return false;
		}

		return true;
	}

	override merge(other: Command): Command {
		if (!(other instanceof BatchUpdateShapesCommand)) return this;

		// Use the newer updates
		return new BatchUpdateShapesCommand(other.updates, this.description);
	}
}
