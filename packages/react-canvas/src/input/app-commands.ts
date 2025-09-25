import type { CommandHandler } from "@usketch/input-manager";
import type { WhiteboardStore } from "@usketch/store";

/**
 * アプリケーション基本操作のコマンドハンドラーを生成
 */
export function createAppCommands(store: WhiteboardStore) {
	const keyboardCommands: Record<string, CommandHandler> = {
		// 基本操作
		undo: () => {
			store.undo();
			return true;
		},

		redo: () => {
			store.redo();
			return true;
		},

		// 選択操作
		selectAll: () => {
			const allShapeIds = Object.keys(store.shapes);
			store.setSelection(allShapeIds);
			return true;
		},

		clearSelection: () => {
			store.clearSelection();
			return true;
		},

		// 削除操作
		delete: () => {
			if (store.selectedShapeIds.size === 0) return false;

			const selectedIds = Array.from(store.selectedShapeIds);
			store.deleteShapes(selectedIds);
			store.clearSelection();
			return true;
		},

		// 複製操作
		duplicate: () => {
			if (store.selectedShapeIds.size === 0) return false;

			const newSelectedIds: string[] = [];

			store.selectedShapeIds.forEach((shapeId) => {
				const shape = store.shapes[shapeId];
				if (!shape) return;

				// 複製したシェイプを少しずらして配置
				const duplicatedShape = {
					...shape,
					id: crypto.randomUUID(),
					x: shape.x + 20,
					y: shape.y + 20,
				};

				store.addShape(duplicatedShape);
				newSelectedIds.push(duplicatedShape.id);
			});

			// 複製されたシェイプを選択
			store.setSelection(newSelectedIds);
			return true;
		},

		// ツール切り替え
		selectTool: () => {
			store.setCurrentTool("select");
			return true;
		},

		rectangleTool: () => {
			store.setCurrentTool("rectangle");
			return true;
		},

		ellipseTool: () => {
			store.setCurrentTool("ellipse");
			return true;
		},

		freedrawTool: () => {
			store.setCurrentTool("freedraw");
			return true;
		},

		// アライメント操作
		alignLeft: () => {
			if (store.selectedShapeIds.size < 2) return false;
			store.alignShapesLeft();
			return true;
		},

		alignCenter: () => {
			if (store.selectedShapeIds.size < 2) return false;
			store.alignShapesCenterHorizontal();
			return true;
		},

		alignRight: () => {
			if (store.selectedShapeIds.size < 2) return false;
			store.alignShapesRight();
			return true;
		},

		alignTop: () => {
			if (store.selectedShapeIds.size < 2) return false;
			store.alignShapesTop();
			return true;
		},

		alignMiddle: () => {
			if (store.selectedShapeIds.size < 2) return false;
			store.alignShapesCenterVertical();
			return true;
		},

		alignBottom: () => {
			if (store.selectedShapeIds.size < 2) return false;
			store.alignShapesBottom();
			return true;
		},

		// レイヤー操作（将来実装予定）
		bringToFront: () => {
			// TODO: レイヤー操作の実装
			console.warn("bringToFront not yet implemented");
			return false;
		},

		sendToBack: () => {
			// TODO: レイヤー操作の実装
			console.warn("sendToBack not yet implemented");
			return false;
		},
	};

	return {
		keyboard: keyboardCommands,
	};
}
