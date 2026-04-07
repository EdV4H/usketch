// Geometry
export type { BoundingBox, Point, Viewport } from "./types/geometry.js";
// Plugin system
export type {
	BoardStore,
	CanvasPointerEvent,
	CanvasWheelEvent,
	Command,
	CommandRegistry,
	CoreEventMap,
	EventBus,
	GpuPrimitive,
	GpuPrimitiveKind,
	Layer,
	LayerManager,
	LayerRenderContext,
	PluginContext,
	RenderTarget,
	ShapeDefinition,
	ShapeRegistry,
	ShortcutRegistry,
	StoreEvent,
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
// Color
export { cssColorToRgba, cssColorToRgbaOrDefault } from "./utils/color.js";
export {
	boundsToScreenRect,
	getSelectionBounds,
	screenToWorld,
	worldToScreen,
} from "./utils/geometry.js";
// Utils
export { generateId } from "./utils/id.js";
// Minimap
export type {
	MinimapInput,
	MinimapRect,
	MinimapResult,
	MinimapViewportRect,
} from "./utils/minimap.js";
export { computeMinimap, minimapToSvg } from "./utils/minimap.js";
// Rotation
export {
	deltaToLocal,
	getRotatedAABB,
	normalizeAngle,
	rotatePoint,
	snapAngle,
	unrotatePoint,
	withRotation,
} from "./utils/rotation.js";
