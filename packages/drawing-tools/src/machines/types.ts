import type { Bounds, Point } from "@usketch/shared-types";

// === Common Types for Tool State Machines ===

export interface ToolContext {
	// Common properties
	cursor: string;
	selectedIds: Set<string>;
	hoveredId: string | null;
}

export interface BaseToolEvent {
	type: string;
	shiftKey?: boolean;
	ctrlKey?: boolean;
	altKey?: boolean;
	metaKey?: boolean;
}

export interface PointerToolEvent extends BaseToolEvent {
	type: "POINTER_DOWN" | "POINTER_MOVE" | "POINTER_UP";
	point: Point;
	target?: string;
	pressure?: number;
}

export interface KeyboardToolEvent extends BaseToolEvent {
	type: "KEY_DOWN" | "KEY_UP" | "ESCAPE" | "DELETE" | "ENTER";
	key?: string;
	code?: string;
}

export interface WheelToolEvent extends BaseToolEvent {
	type: "WHEEL";
	delta: Point;
	point: Point;
}

export type ToolEvent =
	| PointerToolEvent
	| KeyboardToolEvent
	| WheelToolEvent
	| { type: "CANCEL" }
	| { type: "COMPLETE" };

// === Tool Machine Configuration ===

export interface ToolMachineConfig<TContext extends ToolContext = ToolContext> {
	id: string;
	context?: Partial<TContext>;
	states: any;
	actions?: any;
	guards?: any;
	services?: any;
}

// === Tool Manager Types ===

export interface ToolRegistration {
	id: string;
	name: string;
	icon?: string;
	machine: any;
	category?: "select" | "draw" | "shape" | "text" | "utility";
}

export interface ToolManagerContext {
	availableTools: Map<string, ToolRegistration>;
	currentToolId: string | null;
	currentToolActor: any | null;
	toolHistory: string[];
	settings: ToolSettings;
}

export interface ToolSettings {
	gridSize: number;
	snapToGrid: boolean;
	showGuidelines: boolean;
	smoothing: boolean;
	pressure: boolean;
}
