import type { CommandContext, WhiteboardState } from "@usketch/shared-types";
import { DEFAULT_LAYER_METADATA } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

/**
 * レイヤー順序変更コマンド
 * Z-index順を変更し、Undo/Redo可能にする
 */
export class ReorderCommand extends BaseCommand {
	constructor(
		private itemId: string,
		private oldIndex: number,
		private newIndex: number,
	) {
		super(`Reorder layer`);
	}

	execute(context: CommandContext): void {
		context.setState((state) => {
			if (!state.zOrder) {
				state.zOrder = [];
			}

			const zOrder = [...state.zOrder];

			// 配列から要素を削除して新しい位置に挿入
			zOrder.splice(this.oldIndex, 1);
			zOrder.splice(this.newIndex, 0, this.itemId);

			state.zOrder = zOrder;

			// 各要素のzIndexを更新
			this.updateZIndices(state, zOrder);
		});
	}

	undo(context: CommandContext): void {
		context.setState((state) => {
			if (!state.zOrder) return;

			const zOrder = [...state.zOrder];

			// 元の位置に戻す
			zOrder.splice(this.newIndex, 1);
			zOrder.splice(this.oldIndex, 0, this.itemId);

			state.zOrder = zOrder;

			// 各要素のzIndexを更新
			this.updateZIndices(state, zOrder);
		});
	}

	private updateZIndices(state: WhiteboardState, zOrder: string[]): void {
		zOrder.forEach((id, index) => {
			if (state.shapes[id]) {
				if (!state.shapes[id].layer) {
					state.shapes[id].layer = { ...DEFAULT_LAYER_METADATA };
				}
				state.shapes[id].layer.zIndex = index;
			} else if (state.groups?.[id]) {
				state.groups[id].zIndex = index;
			}
		});
	}
}
