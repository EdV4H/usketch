import type { KeyboardPreset } from "../types";

/**
 * デフォルトキーボードプリセット
 */
export const defaultKeyboardPreset: KeyboardPreset = {
	id: "default",
	name: "Default",
	description: "Standard keyboard shortcuts",
	bindings: {
		// ツール切り替え
		"tool.select": ["v", "s"],
		"tool.rectangle": ["r"],
		"tool.ellipse": ["o", "e"],
		"tool.freedraw": ["d", "p"],
		"tool.pan": ["h"],

		// 基本操作
		delete: ["Delete", "Backspace"],
		selectAll: ["mod+a"],
		undo: ["mod+z"],
		redo: ["mod+shift+z", "mod+y"],
		escape: ["Escape"],

		// アライメント
		"align.left": ["mod+shift+ArrowLeft"],
		"align.right": ["mod+shift+ArrowRight"],
		"align.top": ["mod+shift+ArrowUp"],
		"align.bottom": ["mod+shift+ArrowDown"],
		"align.centerH": ["mod+shift+h"], // HorizontalのH
		"align.centerV": ["mod+shift+m"], // Middle（垂直中央）のM

		// カメラ操作
		"camera.zoomIn": ["mod+=", "mod+plus"],
		"camera.zoomOut": ["mod+-", "mod+minus"],
		"camera.zoomReset": ["mod+0"],
		"camera.zoomToFit": ["mod+1"],
		"camera.zoomToSelection": ["mod+2"],
		"camera.panUp": ["shift+ArrowUp"],
		"camera.panDown": ["shift+ArrowDown"],
		"camera.panLeft": ["shift+ArrowLeft"],
		"camera.panRight": ["shift+ArrowRight"],

		// スナップ
		"snap.toggleGrid": ["shift+g"],
		"snap.toggleShape": ["shift+s"],

		// スタイル
		"style.copy": ["mod+shift+c"],
		"style.paste": ["mod+shift+v"],

		// UI
		"ui.togglePropertyPanel": ["mod+,"],
		"ui.toggleDebugPanel": ["mod+shift+d"],

		// スペースキー（特殊扱い）
		"modifier.space": ["Space"],
	},
};
