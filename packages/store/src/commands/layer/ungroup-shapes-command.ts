import type { CommandContext, ShapeGroup } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

/**
 * グループ解除コマンド
 * グループを解除し、Undo/Redo可能にする
 */
export class UngroupShapesCommand extends BaseCommand {
	private group: ShapeGroup | null = null;

	constructor(
		private groupId: string,
		private childIds: string[],
	) {
		super(`Ungroup ${childIds.length} shapes`);
	}

	execute(context: CommandContext): void {
		const state = context.getState();

		// グループ情報を保存（undo用）
		const group = state.groups?.[this.groupId];
		if (group) {
			this.group = group;
		}

		context.setState((mutState) => {
			// グループを削除
			if (mutState.groups) {
				delete mutState.groups[this.groupId];
			}

			// zOrderからグループIDを削除
			if (mutState.zOrder) {
				const index = mutState.zOrder.indexOf(this.groupId);
				if (index !== -1) {
					mutState.zOrder.splice(index, 1);
				}
			}

			// 各形状の親IDをクリアし、zOrderに追加
			this.childIds.forEach((id) => {
				const shape = mutState.shapes[id];
				if (shape?.layer) {
					delete shape.layer.parentId;

					// zOrderに形状IDを追加
					if (mutState.zOrder && !mutState.zOrder.includes(id)) {
						mutState.zOrder.push(id);
					}
				}
			});
		});
	}

	undo(context: CommandContext): void {
		const savedGroup = this.group;
		if (!savedGroup) return;

		context.setState((state) => {
			// グループを復元
			if (!state.groups) {
				state.groups = {};
			}
			state.groups[this.groupId] = savedGroup;

			// zOrderにグループIDを追加
			if (!state.zOrder) {
				state.zOrder = [];
			}
			state.zOrder.push(this.groupId);

			// 各形状の親IDを設定し、zOrderから削除
			this.childIds.forEach((id) => {
				const shape = state.shapes[id];
				if (shape) {
					if (!shape.layer) {
						shape.layer = {
							visible: true,
							locked: false,
							zIndex: 0,
						};
					}
					shape.layer.parentId = this.groupId;

					// zOrderから形状IDを削除
					if (state.zOrder) {
						const index = state.zOrder.indexOf(id);
						if (index !== -1) {
							state.zOrder.splice(index, 1);
						}
					}
				}
			});
		});
	}
}
