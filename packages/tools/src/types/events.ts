// Event type definitions for tool machines

import type { Point } from "@usketch/shared-types";

// Base event types that all tools support
export interface BaseToolEvent {
	type: string;
}

export interface PointerDownEvent extends BaseToolEvent {
	type: "POINTER_DOWN";
	point: Point;
	shiftKey?: boolean;
	ctrlKey?: boolean;
	metaKey?: boolean;
	altKey?: boolean;
	target?: string;
}

export interface PointerMoveEvent extends BaseToolEvent {
	type: "POINTER_MOVE";
	point: Point;
}

export interface PointerUpEvent extends BaseToolEvent {
	type: "POINTER_UP";
	point: Point;
}

export interface DoubleClickEvent extends BaseToolEvent {
	type: "DOUBLE_CLICK";
	point: Point;
	target?: string;
}

export interface KeyDownEvent extends BaseToolEvent {
	type: "KEY_DOWN";
	key: string;
}

export interface EscapeEvent extends BaseToolEvent {
	type: "ESCAPE";
}

export interface DeleteEvent extends BaseToolEvent {
	type: "DELETE";
}

export interface EnterEvent extends BaseToolEvent {
	type: "ENTER";
}

// Union of all tool events
export type ToolEvent =
	| PointerDownEvent
	| PointerMoveEvent
	| PointerUpEvent
	| DoubleClickEvent
	| KeyDownEvent
	| EscapeEvent
	| DeleteEvent
	| EnterEvent;

// React event handlers
export interface ToolEventHandlers {
	onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
	onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
	onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
	onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
	onDoubleClick: (e: React.MouseEvent<HTMLElement>) => void;
}

// Native event handlers
export interface NativeToolEventHandlers {
	onPointerDown: (e: PointerEvent) => void;
	onPointerMove: (e: PointerEvent) => void;
	onPointerUp: (e: PointerEvent) => void;
	onKeyDown: (e: KeyboardEvent) => void;
	onDoubleClick: (e: MouseEvent) => void;
}
