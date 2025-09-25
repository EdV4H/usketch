import { useInputManager } from "@usketch/input-manager";
import { defaultKeyboardPreset, vimKeyboardPreset } from "@usketch/input-presets/keyboard";
import {
	defaultMousePreset,
	gamingMousePreset,
	trackpadMousePreset,
} from "@usketch/input-presets/mouse";
import { whiteboardStore } from "@usketch/store";
import { useEffect } from "react";
import { useToast } from "../contexts/toast-context";

interface UseIntegratedInputOptions {
	keyboardPreset?: "default" | "vim";
	mousePreset?: "default" | "trackpad" | "gaming";
	debug?: boolean;
	onPanelToggle?: () => void;
}

/**
 * 入力システムとCanvasを統合するフック
 */
export function useIntegratedInput(options: UseIntegratedInputOptions = {}) {
	const {
		keyboardPreset = "default",
		mousePreset = "default",
		debug = false,
		onPanelToggle,
	} = options;
	const { showToast } = useToast();

	// 入力マネージャーを初期化
	const inputManager = useInputManager({
		keyboardConfig: {
			preset: keyboardPreset === "vim" ? vimKeyboardPreset : defaultKeyboardPreset,
			debug,
		},
		mouseConfig: {
			preset:
				mousePreset === "trackpad"
					? trackpadMousePreset
					: mousePreset === "gaming"
						? gamingMousePreset
						: defaultMousePreset,
			debug,
		},
		gestureConfig: {
			debug,
		},
		enabled: true,
	});

	// Canvasの操作と入力システムを接続
	useEffect(() => {
		// ツール切り替えコマンド
		inputManager.registerCommand("tool.select", () => {
			const state = whiteboardStore.getState();
			state.setActiveTool("select");
			if (debug) console.log("Tool: Select");
			return true;
		});

		inputManager.registerCommand("tool.rectangle", () => {
			const state = whiteboardStore.getState();
			state.setActiveTool("rectangle");
			if (debug) console.log("Tool: Rectangle");
			return true;
		});

		inputManager.registerCommand("tool.ellipse", () => {
			const state = whiteboardStore.getState();
			state.setActiveTool("ellipse");
			if (debug) console.log("Tool: Ellipse");
			return true;
		});

		inputManager.registerCommand("tool.freedraw", () => {
			const state = whiteboardStore.getState();
			state.setActiveTool("freedraw");
			if (debug) console.log("Tool: Free Draw");
			return true;
		});

		inputManager.registerCommand("tool.pan", () => {
			const state = whiteboardStore.getState();
			state.setActiveTool("pan");
			if (debug) console.log("Tool: Pan");
			return true;
		});

		// 編集コマンド
		inputManager.registerCommand("edit.undo", () => {
			const state = whiteboardStore.getState();
			if (state.canUndo) {
				state.undo();
				if (debug) console.log("Edit: Undo");
			}
			return true;
		});

		inputManager.registerCommand("edit.redo", () => {
			const state = whiteboardStore.getState();
			if (state.canRedo) {
				state.redo();
				if (debug) console.log("Edit: Redo");
			}
			return true;
		});

		inputManager.registerCommand("edit.delete", () => {
			const state = whiteboardStore.getState();
			if (state.selectedShapeIds.size > 0) {
				state.deleteShapes(Array.from(state.selectedShapeIds));
				if (debug) console.log("Edit: Delete");
			}
			return true;
		});

		inputManager.registerCommand("delete", () => {
			const state = whiteboardStore.getState();
			if (state.selectedShapeIds.size > 0) {
				state.deleteShapes(Array.from(state.selectedShapeIds));
				if (debug) console.log("Delete shapes");
			}
			return true;
		});

		inputManager.registerCommand("selectAll", () => {
			const state = whiteboardStore.getState();
			state.selectAllShapes();
			if (debug) console.log("Select all");
			return true;
		});

		inputManager.registerCommand("undo", () => {
			const state = whiteboardStore.getState();
			if (state.canUndo) {
				state.undo();
				if (debug) console.log("Undo");
			}
			return true;
		});

		inputManager.registerCommand("redo", () => {
			const state = whiteboardStore.getState();
			if (state.canRedo) {
				state.redo();
				if (debug) console.log("Redo");
			}
			return true;
		});

		inputManager.registerCommand("escape", () => {
			const state = whiteboardStore.getState();
			if (state.selectedShapeIds.size > 0) {
				state.clearSelection();
			}
			state.setActiveTool("select");
			if (debug) console.log("Escape");
			return true;
		});

		// アライメントコマンド
		inputManager.registerCommand("align.left", () => {
			const state = whiteboardStore.getState();
			if (state.selectedShapeIds.size > 1) {
				state.alignShapes("left");
				if (debug) console.log("Align: Left");
			}
			return true;
		});

		inputManager.registerCommand("align.right", () => {
			const state = whiteboardStore.getState();
			if (state.selectedShapeIds.size > 1) {
				state.alignShapes("right");
				if (debug) console.log("Align: Right");
			}
			return true;
		});

		inputManager.registerCommand("align.top", () => {
			const state = whiteboardStore.getState();
			if (state.selectedShapeIds.size > 1) {
				state.alignShapes("top");
				if (debug) console.log("Align: Top");
			}
			return true;
		});

		inputManager.registerCommand("align.bottom", () => {
			const state = whiteboardStore.getState();
			if (state.selectedShapeIds.size > 1) {
				state.alignShapes("bottom");
				if (debug) console.log("Align: Bottom");
			}
			return true;
		});

		inputManager.registerCommand("align.centerH", () => {
			const state = whiteboardStore.getState();
			if (state.selectedShapeIds.size > 1) {
				state.alignShapes("center-horizontal");
				if (debug) console.log("Align: Center Horizontal");
			}
			return true;
		});

		inputManager.registerCommand("align.centerV", () => {
			const state = whiteboardStore.getState();
			if (state.selectedShapeIds.size > 1) {
				state.alignShapes("center-vertical");
				if (debug) console.log("Align: Center Vertical");
			}
			return true;
		});

		// スナップコマンド
		inputManager.registerCommand("snap.toggleGrid", () => {
			const state = whiteboardStore.getState();
			state.toggleGridSnap();
			if (debug) console.log("Toggle Grid Snap");
			return true;
		});

		inputManager.registerCommand("snap.toggleShape", () => {
			const state = whiteboardStore.getState();
			state.toggleShapeSnap();
			if (debug) console.log("Toggle Shape Snap");
			return true;
		});

		// スタイルコマンド
		inputManager.registerCommand("style.copy", () => {
			const state = whiteboardStore.getState();
			const result = state.copyStyleFromSelection();
			if (result) {
				showToast("スタイルをコピーしました", "success");
				if (debug) console.log("Style: Copy");
			} else {
				showToast("形状が選択されていません", "error");
			}
			return true;
		});

		inputManager.registerCommand("style.paste", () => {
			const state = whiteboardStore.getState();
			const result = state.pasteStyleToSelection();
			if (result) {
				showToast("スタイルを適用しました", "success");
				if (debug) console.log("Style: Paste");
			} else {
				showToast("コピーされたスタイルがありません", "error");
			}
			return true;
		});

		// UIコマンド
		inputManager.registerCommand("ui.togglePropertyPanel", () => {
			onPanelToggle?.();
			if (debug) console.log("UI: Toggle Property Panel");
			return true;
		});

		// カメラ操作コマンド（将来の実装用）
		inputManager.registerCommand("camera.zoomIn", () => {
			if (debug) console.log("Camera: Zoom In");
			// TODO: Implement zoom in
			return true;
		});

		inputManager.registerCommand("camera.zoomOut", () => {
			if (debug) console.log("Camera: Zoom Out");
			// TODO: Implement zoom out
			return true;
		});

		inputManager.registerCommand("camera.reset", () => {
			if (debug) console.log("Camera: Reset");
			// TODO: Implement camera reset
			return true;
		});

		inputManager.registerCommand("camera.pan", () => {
			const state = whiteboardStore.getState();
			state.setActiveTool("pan");
			if (debug) console.log("Camera: Pan");
			return true;
		});

		// マウスコマンド
		inputManager.registerCommand("select", () => {
			if (debug) console.log("Mouse: Select");
			// マウスクリックでの選択はCanvasで直接処理
			return false;
		});

		inputManager.registerCommand("contextMenu", () => {
			if (debug) console.log("Mouse: Context Menu");
			// コンテキストメニューの実装は将来
			return false;
		});

		inputManager.registerCommand("camera.zoom", () => {
			if (debug) console.log("Mouse: Zoom");
			// ホイールズームの実装は将来
			return false;
		});
	}, [inputManager, showToast, debug, onPanelToggle]);

	return inputManager;
}
