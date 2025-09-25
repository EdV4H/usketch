// マネージャー

// プリセット型の再エクスポート
export type { GestureType, KeyboardPreset, MousePreset } from "@usketch/input-presets";
export { GestureManager } from "./gesture/gesture-manager";
export type { InputManagerResult, UseInputManagerOptions } from "./hooks/use-input-manager";

// React統合
export { useInputManager } from "./hooks/use-input-manager";
export { KeyboardManager } from "./keyboard/keyboard-manager";
export { MouseManager } from "./mouse/mouse-manager";
// 型定義
export type {
	CommandHandler,
	DragState,
	EventEmitter,
	GestureEvent,
	GestureState,
	KeyBinding,
	KeyboardConfig,
	MouseBinding,
	MouseConfig,
	PanEvent,
} from "./types";
