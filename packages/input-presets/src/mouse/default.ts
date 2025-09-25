import type { MousePreset } from "../types";

export const defaultMouseMap: MousePreset = {
	id: "default",
	name: "Default Mouse",
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
		pan: {
			button: 1, // 中ボタンドラッグ
			action: "drag",
		},
		// 注: スペースキー押下中の動作は KeyboardManager と連携して実装

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
			modifiers: ["shift"], // 水平/垂直移動
		},

		// ホイール操作
		zoom: {
			wheel: true,
		},
		zoomPrecise: {
			wheel: true,
			modifiers: ["mod"], // 精密ズーム
		},
		horizontalScroll: {
			wheel: true,
			modifiers: ["shift"],
		},

		// ジェスチャー（タッチパッド対応）
		rotate: {
			gesture: "rotate",
		},
		pinchZoom: {
			gesture: "pinch",
		},
	},
};
