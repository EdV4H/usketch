// === Main exports for @usketch/tools ===

// Main Tool Manager
export { ToolManager } from "./adapters/toolManagerAdapter";

// React Components
export { Whiteboard } from "./components/Whiteboard";

// React Hooks
export { useToolMachine, useToolManager } from "./hooks/useToolMachine";

// Machine exports for advanced usage
export type { DrawingToolContext, DrawingToolEvent } from "./machines/drawingTool";
export { drawingToolMachine } from "./machines/drawingTool";
export type { SelectToolContext, SelectToolEvent } from "./machines/selectTool";
export { selectToolMachine } from "./machines/selectTool";
export { createToolMachine } from "./machines/toolMachineFactory";
export { toolManagerMachine } from "./machines/toolManager";
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
