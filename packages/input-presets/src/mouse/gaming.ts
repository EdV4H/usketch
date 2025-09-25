import type { MousePreset } from "../types";

/**
 * ゲーミングマウスプリセット（多ボタンマウス用）
 */
export const gamingMousePreset: MousePreset = {
	id: "gaming",
	name: "Gaming Mouse",
	description: "Optimized for multi-button gaming mice",
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

		// サイドボタン活用
		undo: {
			button: 3, // サイドボタン1（戻る）
		},
		redo: {
			button: 4, // サイドボタン2（進む）
		},
		"tool.select": {
			button: 5, // 追加サイドボタン
		},
		"tool.pan": {
			button: 6, // 追加サイドボタン
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
		quickCopy: {
			button: 3, // サイドボタン + 修飾キー
			modifiers: ["mod"],
		},
		quickPaste: {
			button: 4, // サイドボタン + 修飾キー
			modifiers: ["mod"],
		},

		// ホイール操作
		"camera.zoom": {
			wheel: true,
		},
		"camera.zoomPrecise": {
			wheel: true,
			modifiers: ["mod"],
		},
		"camera.horizontalScroll": {
			wheel: true,
			modifiers: ["shift"],
		},
		"tool.switchNext": {
			wheel: "down",
			modifiers: ["alt"], // Alt+ホイール下でツール切り替え
		},
		"tool.switchPrev": {
			wheel: "up",
			modifiers: ["alt"], // Alt+ホイール上でツール切り替え
		},
	},
};
