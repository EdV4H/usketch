import type { CommandContext, ShapeGroup } from "@usketch/shared-types";
import { DEFAULT_LAYER_METADATA } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

/**
 * グループ化コマンド
 * 選択中の形状をグループ化し、Undo/Redo可能にする
 */
export class GroupShapesCommand extends BaseCommand {
	constructor(
		private shapeIds: string[],
		private group: ShapeGroup,
	) {
		super(`Group ${shapeIds.length} shapes`);
	}

	execute(context: CommandContext): void {
		context.setState((mutState) => {
			// グループ情報を追加
			if (!mutState.groups) {
				mutState.groups = {};
			}
			mutState.groups[this.group.id] = this.group;

			// zOrderに追加
			if (!mutState.zOrder) {
				mutState.zOrder = [];
			}
			mutState.zOrder.push(this.group.id);

			// 各形状の親IDを設定
			this.shapeIds.forEach((id) => {
				const shape = mutState.shapes[id];
				if (shape) {
					if (!shape.layer) {
						shape.layer = { ...DEFAULT_LAYER_METADATA };
					}
					shape.layer.parentId = this.group.id;

					// zOrderから形状IDを削除（グループIDで代表）
					if (mutState.zOrder) {
						const index = mutState.zOrder.indexOf(id);
						if (index !== -1) {
							mutState.zOrder.splice(index, 1);
						}
					}
				}
			});
		});
	}

	undo(context: CommandContext): void {
		context.setState((state) => {
			// グループを削除
			if (state.groups) {
				delete state.groups[this.group.id];
			}

			// zOrderからグループIDを削除
			if (state.zOrder) {
				const index = state.zOrder.indexOf(this.group.id);
				if (index !== -1) {
					state.zOrder.splice(index, 1);
				}
			}

			// 各形状の親IDをクリアし、zOrderに戻す
			this.shapeIds.forEach((id) => {
				const shape = state.shapes[id];
				if (shape?.layer) {
					delete shape.layer.parentId;

					// zOrderに形状IDを追加
					if (state.zOrder && !state.zOrder.includes(id)) {
						state.zOrder.push(id);
					}
				}
			});
		});
	}
}
