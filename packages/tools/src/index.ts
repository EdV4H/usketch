// === Main exports for @usketch/tools ===

// Main Tool Manager
export { ToolManager } from "./adapters/tool-manager-adapter";
// Helper for backward compatibility with default tools
export { createDefaultToolManager } from "./adapters/tool-manager-compat";

// Tool configurations
export { createDefaultToolManagerOptions, getDefaultTools } from "./configs/default-tools";
export { createToolMachine } from "./core/tool-machine-factory";
export { toolManagerMachine } from "./core/tool-manager";
// Machine exports for advanced usage
export type { DrawingToolContext, DrawingToolEvent } from "./tools/drawing-tool";
export { createDrawingTool } from "./tools/drawing-tool";
export type { EffectFactory, EffectToolConfig } from "./tools/effect-tool";
// Effect Tool
export { EffectTool, getEffectTool } from "./tools/effect-tool";
export type { SelectToolContext, SelectToolEvent } from "./tools/select-tool";
export { createSelectTool, selectToolMachine } from "./tools/select-tool";
// Event types
export type {
	ToolEvent as ToolEventType,
	ToolEventHandlers,
} from "./types/events";
// Types
export type {
	Bounds,
	Point,
	Shape,
	ShapeStyle,
	ToolContext,
	ToolEvent,
} from "./types/index";
// State types
export type {
	ToolContextUnion,
	ToolManagerState,
	ToolStateValue,
} from "./types/state";
// Utils
export * from "./utils/geometry";
export type { SnapGuide } from "./utils/snap-engine";
export { SnapEngine } from "./utils/snap-engine";
