// === Main exports for @usketch/tools ===

// New Tool Manager V2
export { ToolManagerV2 } from "./adapters/toolManagerAdapterV2";
// Main Tool Manager (backward compatible)
export { createDefaultToolManager, ToolManager } from "./adapters/toolManagerCompat";

// Tool configurations
export { createDefaultToolManagerOptions, getDefaultTools } from "./configs/default-tools";

// Machine exports for advanced usage
export type { DrawingToolContext, DrawingToolEvent } from "./machines/drawingTool";
export { createDrawingTool } from "./machines/drawingTool";
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

// Event types
export type {
	ToolEvent as ToolEventType,
	ToolEventHandlers,
} from "./types/events";

// State types
export type {
	ToolContextUnion,
	ToolManagerState,
	ToolStateValue,
} from "./types/state";

// Utils
export * from "./utils/geometry";
export { SnapEngine } from "./utils/snapEngine";
