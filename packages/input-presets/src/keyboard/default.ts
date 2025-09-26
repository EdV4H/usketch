import type { KeyboardPreset } from "../types";

export const defaultKeymap: KeyboardPreset = {
	id: "default",
	name: "Default",
	description: "Standard keyboard shortcuts",
	bindings: {
		// ツール
		select: ["v", "s"],
		rectangle: ["r"],
		ellipse: ["o", "e"],
		freedraw: ["d", "p"],
		pan: ["h"],

		// 基本操作
		delete: ["Delete", "Backspace"],
		selectAll: ["mod+a"],
		undo: ["mod+z"],
		redo: ["mod+shift+z", "mod+y"],
		escape: ["Escape"],

		// アライメント
		alignLeft: ["mod+shift+ArrowLeft"],
		alignRight: ["mod+shift+ArrowRight"],
		alignTop: ["mod+shift+ArrowUp"],
		alignBottom: ["mod+shift+ArrowDown"],
		alignCenterH: ["mod+shift+h"],
		alignCenterV: ["mod+shift+m"],

		// カメラ操作
		zoomIn: ["mod+=", "mod+plus"],
		zoomOut: ["mod+-", "mod+minus"],
		zoomReset: ["mod+0"],
		zoomToFit: ["mod+1"],
		zoomToSelection: ["mod+2"],
		panUp: ["shift+ArrowUp"],
		panDown: ["shift+ArrowDown"],
		panLeft: ["shift+ArrowLeft"],
		panRight: ["shift+ArrowRight"],

		// スナップ
		toggleGridSnap: ["shift+g"],
		toggleShapeSnap: ["shift+s"],

		// スタイル
		copyStyle: ["mod+shift+c"],
		pasteStyle: ["mod+shift+v"],

		// UI
		togglePropertyPanel: ["mod+,"],
		toggleDebugPanel: ["mod+shift+d"],
	},
};
