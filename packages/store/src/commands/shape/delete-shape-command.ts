import type { CommandContext, Shape } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

export class DeleteShapeCommand extends BaseCommand {
	private deletedShape?: Shape;
	private wasSelected: boolean = false;
	private zOrderIndex: number = -1;

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
		this.zOrderIndex = state.zOrder ? state.zOrder.indexOf(this.shapeId) : -1;

		context.setState((state) => {
			delete state.shapes[this.shapeId];
			state.selectedShapeIds.delete(this.shapeId);
			// zOrderから削除
			if (state.zOrder) {
				const index = state.zOrder.indexOf(this.shapeId);
				if (index !== -1) {
					state.zOrder.splice(index, 1);
				}
			}
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
				// zOrderに復元（元の位置に挿入）
				if (!state.zOrder) {
					state.zOrder = [];
				}
				if (this.zOrderIndex !== -1) {
					state.zOrder.splice(this.zOrderIndex, 0, this.shapeId);
				} else {
					state.zOrder.push(this.shapeId);
				}
			});
		}
	}
}
