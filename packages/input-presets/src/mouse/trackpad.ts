import type { MousePreset } from "../types";

/**
 * トラックパッド最適化プリセット
 */
export const trackpadMousePreset: MousePreset = {
	id: "trackpad",
	name: "Trackpad Optimized",
	description: "Optimized for trackpad/touchpad",
	bindings: {
		// 基本操作
		select: {
			button: 0, // タップ
		},
		contextMenu: {
			button: 2, // 2本指タップ または 右クリック
		},

		// ジェスチャーベース操作
		"camera.pan": {
			gesture: "twoFingerDrag", // 2本指ドラッグ
		},
		"camera.zoom": {
			gesture: "pinch", // ピンチジェスチャー
		},
		rotate: {
			gesture: "rotate", // 2本指回転
		},

		// スワイプジェスチャー
		"navigate.back": {
			gesture: "swipe",
			modifiers: ["left"],
		},
		"navigate.forward": {
			gesture: "swipe",
			modifiers: ["right"],
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

		// スマートズーム
		"camera.smartZoom": {
			gesture: "doubleTap", // 2本指ダブルタップ
		},
	},
};
