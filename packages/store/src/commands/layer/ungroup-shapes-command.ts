import type { CommandContext, Shape, ShapeGroup } from "@usketch/shared-types";
import { BaseCommand } from "../base-command";

/**
 * グループ解除コマンド
 * グループを解除して個別の形状に戻す（Undo/Redo対応）
 */
export class UngroupShapesCommand extends BaseCommand {
	private groupId: string;
	private previousGroup: ShapeGroup | null = null;
	private previousShapeStates: Array<{ id: string; layer?: any }> = [];
	private previousZOrder: string[] = [];

	constructor(groupId: string) {
		super(`Ungroup shapes`);
		this.groupId = groupId;
	}

	execute(context: CommandContext): void {
		const state = context.getState();
		const store = state as any;

		// 現在の状態を保存（Undo用）
		this.previousGroup = store.groups?.[this.groupId] || null;
		if (!this.previousGroup) return;

		this.previousShapeStates = this.previousGroup.childIds.map((id) => ({
			id,
			layer: state.shapes[id]?.layer,
		}));
		this.previousZOrder = [...(store.zOrder || [])];

		context.setState((draft) => {
			const draftStore = draft as any;

			// グループを取得
			const group = draftStore.groups?.[this.groupId];
			if (!group) return;

			// 形状からグループ参照を削除
			group.childIds.forEach((id: string) => {
				const shape = draft.shapes[id];
				if (shape?.layer) {
					const { parentId: _, ...restLayer } = shape.layer;
					draft.shapes[id] = { ...shape, layer: restLayer } as Shape;
				}
			});

			// グループを削除
			const newGroups = { ...draftStore.groups };
			delete newGroups[this.groupId];
			draftStore.groups = newGroups;

			// zOrderを更新
			const newZOrder = draftStore.zOrder.flatMap((id: string) =>
				id === this.groupId ? group.childIds : [id],
			);
			draftStore.zOrder = newZOrder;
		});
	}

	undo(context: CommandContext): void {
		if (!this.previousGroup) return;

		context.setState((draft) => {
			const store = draft as any;

			// グループを復元
			store.groups = { ...store.groups, [this.groupId]: this.previousGroup };

			// 形状の状態を復元
			this.previousShapeStates.forEach(({ id, layer }) => {
				const shape = draft.shapes[id];
				if (shape) {
					if (layer) {
						draft.shapes[id] = { ...shape, layer } as Shape;
					} else {
						const { layer: _, ...rest } = shape;
						draft.shapes[id] = rest as Shape;
					}
				}
			});

			// zOrderを復元
			store.zOrder = this.previousZOrder;
		});
	}
}
