// State type definitions for tool machines

import type { Actor, ActorRefFrom, AnyStateMachine, StateValue } from "xstate";
import type { DrawingToolContext } from "../machines/drawingTool";
import type { SelectToolContext } from "../machines/selectTool";
import type { ToolContext } from "../types";

// Tool state union type
export type ToolStateValue = StateValue;

// Tool context union type
export type ToolContextUnion = SelectToolContext | DrawingToolContext | ToolContext;

// Tool actor type
export type ToolActor = Actor<AnyStateMachine>;

// Tool manager state
export interface ToolManagerState {
	context: {
		availableTools: Map<string, AnyStateMachine>;
		currentToolId: string | null;
		currentToolActor: ActorRefFrom<AnyStateMachine> | null;
		toolHistory: string[];
		activeTool: string | null;
	};
	value: StateValue;
}

// Tool machine return type
export interface UseToolMachineReturn {
	state: ToolStateValue;
	context: any; // Use any here since it can be different context types
	send: (event: any) => void;
	handlers: {
		onPointerDown: (e: PointerEvent) => void;
		onPointerMove: (e: PointerEvent) => void;
		onPointerUp: (e: PointerEvent) => void;
		onKeyDown: (e: KeyboardEvent) => void;
		onDoubleClick: (e: MouseEvent) => void;
	};
	isIn: (stateValue: string) => boolean;
	actor: ToolActor;
}
