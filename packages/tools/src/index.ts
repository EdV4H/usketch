// === Main exports for @usketch/tools ===

// Main Tool Manager
export { ToolManager } from "./adapters/tool-manager-adapter";
// Helper for backward compatibility with default tools
export { createDefaultToolManager } from "./adapters/tool-manager-compat";

// Tool configurations
export { createDefaultToolManagerOptions, getDefaultTools } from "./configs/default-tools";
export type { EffectToolConfig } from "./effect/effect-tool";
// Effect Tool
export { EffectTool, getEffectTool } from "./effect/effect-tool";
// Machine exports for advanced usage
export type { DrawingToolContext, DrawingToolEvent } from "./machines/drawing-tool";
export { createDrawingTool } from "./machines/drawing-tool";
export type { SelectToolContext, SelectToolEvent } from "./machines/select-tool";
export { selectToolMachine } from "./machines/select-tool";
export { createToolMachine } from "./machines/tool-machine-factory";
export { toolManagerMachine } from "./machines/tool-manager";
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
export { SnapEngine } from "./utils/snap-engine";
