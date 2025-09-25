/**
 * キーボードプリセットの定義
 */
export interface KeyboardPreset {
	id: string;
	name: string;
	description: string;
	bindings: KeyboardBindings;
}

export interface KeyboardBindings {
	[command: string]: string[];
}

/**
 * マウスプリセットの定義
 */
export interface MousePreset {
	id: string;
	name: string;
	description: string;
	bindings: MouseBindings;
}

export interface MouseBindings {
	[command: string]: MouseBinding;
}

export interface MouseBinding {
	button?: number;
	action?: "click" | "drag";
	wheel?: boolean | "up" | "down";
	gesture?: GestureType;
	modifiers?: ModifierKey[];
}

export type ModifierKey = "mod" | "shift" | "alt";

export type GestureType =
	| "pinch"
	| "rotate"
	| "swipe"
	| "twoFingerDrag"
	| "doubleTap"
	| "longPress"
	| "drag";
