// Geometry
export type { BoundingBox, Point, Viewport } from "./types/geometry.js";
// Plugin system
export type {
	BoardStore,
	CanvasPointerEvent,
	CanvasWheelEvent,
	Command,
	CommandRegistry,
	EventBus,
	Layer,
	LayerManager,
	LayerRenderContext,
	PluginContext,
	RenderTarget,
	ResolvedLayer,
	ShapeDefinition,
	ShapeRegistry,
	ShortcutRegistry,
	ToolContext,
	ToolDefinition,
	ToolRegistry,
	TransientObject,
	TransientRegistry,
	TransientRenderer,
	UsketchPlugin,
} from "./types/plugin.js";
// Shape
export type { ResizeHandle, ShapeData, ShapeStyle } from "./types/shape.js";
export { DEFAULT_STYLE } from "./types/shape.js";
// Theme
export type { Theme } from "./types/theme.js";
export { DEFAULT_THEME } from "./types/theme.js";

// Utils
export { generateId } from "./utils/id.js";
