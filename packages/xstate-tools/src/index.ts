// === Main exports for @usketch/xstate-tools ===

// React Components
export { Whiteboard } from "./components/Whiteboard";
// React Hooks
export { useToolMachine, useToolManager } from "./hooks/useToolMachine";
export type { DrawingToolContext, DrawingToolEvent } from "./machines/drawingTool";
export { drawingToolMachine } from "./machines/drawingTool";
export type { SelectToolContext, SelectToolEvent } from "./machines/selectTool";
// Machines
export { selectToolMachine } from "./machines/selectTool";
// Machine Factory
export { createToolMachine } from "./machines/toolMachineFactory";
export { ToolManager, toolManagerMachine } from "./machines/toolManager";
// Types
export type {
	Bounds,
	Point,
	Shape,
	ShapeStyle,
	ToolContext,
	ToolEvent,
} from "./types";

// Utils
export * from "./utils/geometry";
export { SnapEngine } from "./utils/snapEngine";
