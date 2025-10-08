import type { CommandContext, Shape } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

export class CreateShapeCommand extends BaseCommand {
	constructor(private shape: Shape) {
		super(`Create ${shape.type}`);
	}

	execute(context: CommandContext): void {
		context.setState((state) => {
			state.shapes[this.shape.id] = this.shape;
			// zOrderに追加（最前面に配置）
			if (!state.zOrder) {
				state.zOrder = [];
			}
			if (!state.zOrder.includes(this.shape.id)) {
				state.zOrder.push(this.shape.id);
			}
		});
	}

	undo(context: CommandContext): void {
		context.setState((state) => {
			delete state.shapes[this.shape.id];
			state.selectedShapeIds.delete(this.shape.id);
			// zOrderからも削除
			if (state.zOrder) {
				const index = state.zOrder.indexOf(this.shape.id);
				if (index !== -1) {
					state.zOrder.splice(index, 1);
				}
			}
		});
	}
}
