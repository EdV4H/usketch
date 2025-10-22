import type { CommandContext, GroupShape, Shape } from "@usketch/shared-types";
import { whiteboardStore } from "../../store";
import { BaseCommand } from "../base-command";

/**
 * グループ解除コマンド
 * グループを解除して個別の形状に戻す（Undo/Redo対応）
 */
export class UngroupShapesCommand extends BaseCommand {
	private groupId: string;
	private previousGroup: GroupShape | null = null;
	private previousShapeStates: Array<{ id: string; layer?: any }> = [];
	private previousZOrder: string[] = [];

	constructor(groupId: string) {
		super(`Ungroup shapes`);
		this.groupId = groupId;
	}

	execute(context: CommandContext): void {
		const state = context.getState();
		const fullStore = whiteboardStore.getState();

		// 現在の状態を保存（Undo用）
		const groupShape = state.shapes[this.groupId];
		if (!groupShape || groupShape.type !== "group") return;

		this.previousGroup = groupShape as GroupShape;
		this.previousShapeStates = this.previousGroup.childIds.map((id) => ({
			id,
			layer: state.shapes[id]?.layer,
		}));
		this.previousZOrder = fullStore.zOrder ? [...fullStore.zOrder] : [];

		context.setState((draft) => {
			const draftStore = draft as any;

			// GroupShapeを取得
			const groupShape = draft.shapes[this.groupId];
			if (!groupShape || groupShape.type !== "group") return;

			const group = groupShape as GroupShape;

			// 形状からグループ参照を削除
			group.childIds.forEach((id: string) => {
				const shape = draft.shapes[id];
				if (shape?.layer) {
					const { parentId: _, ...restLayer } = shape.layer;
					draft.shapes[id] = { ...shape, layer: restLayer } as Shape;
				}
			});

			// GroupShapeをshapesから削除
			delete draft.shapes[this.groupId];

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

			// GroupShapeを復元
			draft.shapes[this.groupId] = this.previousGroup as Shape;

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
