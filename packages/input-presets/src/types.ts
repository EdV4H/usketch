export interface KeyboardPreset {
	id: string;
	name: string;
	description: string;
	bindings: KeyBindings;
}

export interface KeyBindings {
	[command: string]: string[];
}

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
	command?: string;
	button?: number;
	action?: "click" | "drag";
	wheel?: boolean | "up" | "down";
	gesture?: GestureType;
	modifiers?: string[];
}

export type GestureType =
	| "pinch"
	| "rotate"
	| "swipe"
	| "twoFingerDrag"
	| "doubleTap"
	| "doubleTapTwoFinger"
	| "twoFingerRotate"
	| "longPress"
	| "drag";
