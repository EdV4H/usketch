import type { CommandContext, GroupShape, Shape } from "@usketch/shared-types";
import { createDefaultGroupShape, DEFAULT_LAYER_METADATA } from "@usketch/shared-types";
import { nanoid } from "nanoid";
import { type ExtendedWhiteboardState, whiteboardStore } from "../../store";
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

	getGroupId(): string {
		return this.groupId;
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
			const store = draft as ExtendedWhiteboardState;

			// Calculate bounding box for the group
			let minX = Number.POSITIVE_INFINITY;
			let minY = Number.POSITIVE_INFINITY;
			let maxX = Number.NEGATIVE_INFINITY;
			let maxY = Number.NEGATIVE_INFINITY;

			this.shapeIds.forEach((id) => {
				const shape = draft.shapes[id];
				if (shape) {
					const x = shape.x;
					const y = shape.y;
					const width = "width" in shape ? shape.width : 0;
					const height = "height" in shape ? shape.height : 0;

					minX = Math.min(minX, x);
					minY = Math.min(minY, y);
					maxX = Math.max(maxX, x + width);
					maxY = Math.max(maxY, y + height);
				}
			});

			const bounds = {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY,
			};

			// グループをGroupShapeとして作成
			const newGroupShape: GroupShape = createDefaultGroupShape(
				this.groupId,
				this.groupName,
				bounds,
			);
			newGroupShape.childIds = this.shapeIds;
			const maxZIndex = Math.max(
				...this.shapeIds.map((id) => draft.shapes[id]?.layer?.zIndex ?? 0),
			);
			if (newGroupShape.layer) {
				newGroupShape.layer = {
					...newGroupShape.layer,
					zIndex: maxZIndex,
				};
			}

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

			// GroupShapeをshapesに追加
			draft.shapes[this.groupId] = newGroupShape;

			// zOrderを更新（存在しない場合は初期化）
			const currentZOrder = store.zOrder || [];
			const newZOrder = currentZOrder.filter((id: string) => !this.shapeIds.includes(id));
			newZOrder.push(this.groupId);
			store.zOrder = newZOrder;
		});
	}

	undo(context: CommandContext): void {
		context.setState((draft) => {
			const store = draft as ExtendedWhiteboardState;

			// GroupShapeをshapesから削除
			delete draft.shapes[this.groupId];

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
