import type { KeyboardPreset } from "../types";

/**
 * Vimスタイルキーボードプリセット
 */
export const vimKeyboardPreset: KeyboardPreset = {
	id: "vim",
	name: "Vim-style",
	description: "Vim-inspired keyboard shortcuts",
	bindings: {
		// 移動（Vimスタイル）
		"camera.panLeft": ["h"],
		"camera.panDown": ["j"],
		"camera.panUp": ["k"],
		"camera.panRight": ["l"],

		// ツール切り替え（Vimスタイル）
		"tool.select": ["v"], // Visual mode
		"tool.rectangle": ["r"],
		"tool.ellipse": ["o"],
		"tool.freedraw": ["i"], // Insert mode
		"tool.pan": ["ctrl+h"],

		// 編集
		delete: ["x", "d"],
		selectAll: ["mod+a", "g+g+V+G"], // ggVG相当
		undo: ["u"],
		redo: ["ctrl+r"],
		escape: ["Escape"],

		// ズーム
		"camera.zoomIn": ["+", "="],
		"camera.zoomOut": ["-"],
		"camera.zoomReset": ["0"],
		"camera.zoomToFit": ["z+a"], // Zoom All
		"camera.zoomToSelection": ["z+s"], // Zoom Selection

		// アライメント（標準と同じ）
		"align.left": ["mod+shift+ArrowLeft"],
		"align.right": ["mod+shift+ArrowRight"],
		"align.top": ["mod+shift+ArrowUp"],
		"align.bottom": ["mod+shift+ArrowDown"],
		"align.centerH": ["mod+shift+h"],
		"align.centerV": ["mod+shift+m"],

		// スナップ
		"snap.toggleGrid": ["shift+g"],
		"snap.toggleShape": ["shift+s"],

		// スタイル
		"style.copy": ["y+s"], // Yank Style
		"style.paste": ["p+s"], // Paste Style

		// UI
		"ui.togglePropertyPanel": ["mod+,"],
		"ui.toggleDebugPanel": ["mod+shift+d"],

		// スペースキー
		"modifier.space": ["Space"],
	},
};
