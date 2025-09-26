import type { KeyboardPreset } from "../types";

export const vimKeymap: KeyboardPreset = {
	id: "vim",
	name: "Vim-style",
	description: "Vim-inspired keyboard shortcuts",
	bindings: {
		// ツール（Vimのモードに似せる）
		select: ["Escape"], // Normal mode
		rectangle: ["r"],
		ellipse: ["o"],
		freedraw: ["i"], // Insert mode (draw)
		pan: ["v"], // Visual mode (pan/view)

		// 移動（Vimの基本移動）
		panLeft: ["h"],
		panDown: ["j"],
		panUp: ["k"],
		panRight: ["l"],

		// 大きな移動
		panPageUp: ["mod+u"],
		panPageDown: ["mod+d"],
		panHome: ["g+g"],
		panEnd: ["G"],

		// 基本操作
		delete: ["d+d", "x"],
		selectAll: ["g+g+V+G"],
		undo: ["u"],
		redo: ["mod+r"],
		escape: ["Escape"],

		// ズーム（Vimのウィンドウ操作風）
		zoomIn: ["z+i", "mod+="],
		zoomOut: ["z+o", "mod+-"],
		zoomReset: ["z+z", "mod+0"],
		zoomToFit: ["z+f", "mod+1"],
		zoomToSelection: ["z+s", "mod+2"],

		// アライメント
		alignLeft: ["<+<"],
		alignRight: [">+>"],
		alignTop: ["[+["],
		alignBottom: ["]+]"],
		alignCenterH: ["=+h"],
		alignCenterV: ["=+v"],

		// 検索と選択
		search: ["/"],
		findNext: ["n"],
		findPrevious: ["N"],

		// スナップ
		toggleGridSnap: [":+g+r+i+d"],
		toggleShapeSnap: [":+s+n+a+p"],

		// スタイル（Vimのyank/paste風）
		copyStyle: ["y+s"],
		pasteStyle: ["p+s"],
		copy: ["y+y"],
		paste: ["p"],

		// UI
		togglePropertyPanel: [":+s+e+t"],
		toggleDebugPanel: [":+d+e+b+u+g"],
		commandPalette: [":"],
	},
};
