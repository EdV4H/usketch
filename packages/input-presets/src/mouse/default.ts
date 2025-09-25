import type { MousePreset } from "../types";

/**
 * デフォルトマウスプリセット（標準マウス用）
 */
export const defaultMousePreset: MousePreset = {
	id: "default",
	name: "Standard Mouse",
	description: "Standard mouse bindings",
	bindings: {
		// 基本操作
		select: {
			button: 0, // 左クリック
		},
		contextMenu: {
			button: 2, // 右クリック
		},

		// カメラ操作
		"camera.pan": {
			button: 1, // 中ボタン
			action: "drag",
		},

		// 修飾キー付き操作
		multiSelect: {
			button: 0,
			modifiers: ["shift"],
		},
		duplicateDrag: {
			button: 0,
			action: "drag",
			modifiers: ["alt"],
		},
		constrainedMove: {
			button: 0,
			action: "drag",
			modifiers: ["shift"], // 水平/垂直移動制限
		},

		// ホイール操作
		"camera.zoom": {
			wheel: true,
		},
		"camera.zoomPrecise": {
			wheel: true,
			modifiers: ["mod"], // 精密ズーム
		},
		"camera.horizontalScroll": {
			wheel: true,
			modifiers: ["shift"],
		},
	},
};
