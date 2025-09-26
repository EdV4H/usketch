import type { MousePreset } from "../types";

export const trackpadPreset: MousePreset = {
	id: "trackpad",
	name: "Trackpad Optimized",
	description: "Optimized for trackpad/touchpad",
	bindings: {
		// 基本操作
		select: {
			button: 0, // タップまたは左クリック
		},
		contextMenu: {
			button: 2, // 二本指タップまたは右クリック
		},

		// ジェスチャーメイン操作
		pan: {
			gesture: "twoFingerDrag",
		},
		zoom: {
			gesture: "pinch",
		},
		rotate: {
			gesture: "twoFingerRotate",
		},
		smartZoom: {
			gesture: "doubleTapTwoFinger",
		},

		// スクロール操作
		scroll: {
			gesture: "twoFingerDrag",
		},
		horizontalScroll: {
			gesture: "twoFingerDrag",
			modifiers: ["shift"],
		},

		// 修飾キー付き操作
		multiSelect: {
			button: 0,
			modifiers: ["mod"], // Cmd/Ctrl + クリック
		},
		quickSelect: {
			gesture: "doubleTap",
		},
		rangeSelect: {
			button: 0,
			action: "drag",
			modifiers: ["shift"],
		},

		// 三本指ジェスチャー（高度な操作）
		swipeBack: {
			gesture: "swipe",
			modifiers: ["threeFingers", "left"],
		},
		swipeForward: {
			gesture: "swipe",
			modifiers: ["threeFingers", "right"],
		},
		missionControl: {
			gesture: "swipe",
			modifiers: ["threeFingers", "up"],
		},

		// フォースタッチ（感圧タッチパッド対応）
		quickLook: {
			gesture: "longPress",
		},
	},
};
