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
// Effect Tool (now registry-based)
export type { EffectToolConfig } from "./tools/effect-tool";
export { EffectTool } from "./tools/effect-tool";
export type { EffectToolContext, EffectToolEvent } from "./tools/effect-tool-machine";
export { createEffectTool, effectToolMachine } from "./tools/effect-tool-machine";
export type { PanToolContext, PanToolEvent } from "./tools/pan-tool";
export { createPanTool, panToolMachine } from "./tools/pan-tool";
export type { SelectToolContext, SelectToolEvent } from "./tools/select-tool";
export {
	createSelectTool,
	getSnapRangeSettings,
	selectToolMachine,
	updateSnapRange,
} from "./tools/select-tool";
// Shape Drawing Tools
export type { ShapeDrawingContext, ShapeDrawingEvent, ShapeType } from "./tools/shape-drawing-tool";
export {
	createShapeDrawingTool,
	ellipseToolMachine,
	freedrawToolMachine,
	rectangleToolMachine,
} from "./tools/shape-drawing-tool";
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
export { QuadTree } from "./utils/quad-tree";
export {
	type AlignmentType,
	type DistributionType,
	SnapEngine,
	type SnapGuide,
	type SnapOptions,
	type SnapResult,
} from "./utils/snap-engine";
