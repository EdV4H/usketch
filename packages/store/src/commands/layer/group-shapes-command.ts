import type { CommandContext, Shape, ShapeGroup } from "@usketch/shared-types";
import { createDefaultGroup, DEFAULT_LAYER_METADATA } from "@usketch/shared-types";
import { nanoid } from "nanoid";
import { whiteboardStore } from "../../store";
import { BaseCommand } from "../base-command";

/**
 * グループ化コマンド
 * 複数の形状をグループ化する（Undo/Redo対応）
 */
export class GroupShapesCommand extends BaseCommand {
	private groupId: string;
	private shapeIds: string[];
	private groupName: string;
	private previousShapeStates: Array<{ id: string; layer?: any }> = [];
	private previousZOrder: string[] = [];

	constructor(shapeIds: string[], groupName: string) {
		super(`Group ${shapeIds.length} shapes`);
		this.shapeIds = shapeIds;
		this.groupName = groupName;
		this.groupId = nanoid();
	}

	execute(context: CommandContext): void {
		const state = context.getState();
		const fullStore = whiteboardStore.getState();

		// 現在の状態を保存（Undo用）
		this.previousShapeStates = this.shapeIds.map((id) => ({
			id,
			layer: state.shapes[id]?.layer,
		}));
		this.previousZOrder = fullStore.zOrder ? [...fullStore.zOrder] : [];

		context.setState((draft) => {
			const store = draft as any;

			// グループを作成
			const newGroup: ShapeGroup = {
				id: this.groupId,
				...createDefaultGroup(this.groupName),
				childIds: this.shapeIds,
				zIndex: Math.max(...this.shapeIds.map((id) => draft.shapes[id]?.layer?.zIndex ?? 0)),
			};

			// 形状にグループ参照を追加
			this.shapeIds.forEach((id) => {
				const shape = draft.shapes[id];
				if (shape) {
					draft.shapes[id] = {
						...shape,
						layer: {
							...(shape.layer || DEFAULT_LAYER_METADATA),
							parentId: this.groupId,
						},
					} as Shape;
				}
			});

			// zOrderを更新（存在しない場合は初期化）
			const currentZOrder = store.zOrder || [];
			const newZOrder = currentZOrder.filter((id: string) => !this.shapeIds.includes(id));
			newZOrder.push(this.groupId);

			if (!store.groups) {
				store.groups = {};
			}
			store.groups = { ...store.groups, [this.groupId]: newGroup };
			store.zOrder = newZOrder;
		});
	}

	undo(context: CommandContext): void {
		context.setState((draft) => {
			const store = draft as any;

			// グループを削除
			if (store.groups) {
				const newGroups = { ...store.groups };
				delete newGroups[this.groupId];
				store.groups = newGroups;
			}

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
