// Geometry
export type { BoundingBox, Point, Viewport } from "./types/geometry.js";
// LOD
export type { LodController, LodPolicy, LodPolicyContext, RenderMode } from "./types/lod.js";
// Plugin system
export type {
	ActionParam,
	ActionRegistry,
	BoardStore,
	CanvasPointerEvent,
	CanvasWheelEvent,
	Command,
	CommandRegistry,
	CoreEventMap,
	EventBus,
	ExternalContent,
	ExternalContentBase,
	ExternalContentFile,
	ExternalContentHandler,
	ExternalContentHandlerCtx,
	ExternalContentKind,
	ExternalContentOf,
	ExternalContentRegistry,
	ExternalContentText,
	ExternalContentUrl,
	ExternalContentVia,
	GpuPrimitive,
	GpuPrimitiveKind,
	Layer,
	LayerManager,
	LayerRenderContext,
	PluginAction,
	PluginContext,
	PluginTeardown,
	RenderTarget,
	SelectionForeground,
	SelectionForegroundRegistry,
	ShapeChange,
	ShapeDefinition,
	ShapeRegistry,
	ShapeSerializeContext,
	ShortcutRegistry,
	StoreEvent,
	StoreEventType,
	ToolContext,
	ToolDefinition,
	ToolRegistry,
	TransientObject,
	TransientRegistry,
	TransientRenderer,
	UiRegistry,
	UsketchPlugin,
} from "./types/plugin.js";
// Shape
export type { ResizeHandle, ShapeData, ShapeStyle } from "./types/shape.js";
export { DEFAULT_STYLE } from "./types/shape.js";
// Theme
export type { Theme } from "./types/theme.js";
export { DEFAULT_THEME } from "./types/theme.js";
// Attachable (child-side)
export {
	attachableAcceptsTarget,
	getAttachableHitTest,
	isAttachable,
	isAttachableFollow,
} from "./utils/attachable.js";
// Color
export { cssColorToRgba, cssColorToRgbaOrDefault } from "./utils/color.js";
// Container
export {
	getContainerLayout,
	hasSelectableChildren,
	isContainerAutoAttach,
	isShapeContainer,
} from "./utils/container.js";
export {
	boundsToScreenRect,
	getSelectionBounds,
	screenToWorld,
	worldToScreen,
} from "./utils/geometry.js";
// Utils
export { generateId } from "./utils/id.js";
// LOD shape projection
export type { LodShape } from "./utils/lod-shape.js";
export { toLodShape, toLodShapes } from "./utils/lod-shape.js";
// Minimap
export type {
	MinimapInput,
	MinimapRect,
	MinimapResult,
	MinimapViewportRect,
} from "./utils/minimap.js";
export { computeMinimap, minimapToSvg } from "./utils/minimap.js";
// Resizable resolution
export { isShapeResizable } from "./utils/resizable.js";
// Rotation
export {
	deltaToLocal,
	getRotatedAABB,
	normalizeAngle,
	rotatePoint,
	safeRotation,
	snapAngle,
	unrotatePoint,
	withRotation,
} from "./utils/rotation.js";
// Shape diff
export { bidiffShape, diffShape } from "./utils/shape-diff.js";
// Z-order
export {
	compareZIndex,
	zIndexAfterAll,
	zIndexBeforeAll,
	zIndexBetween,
} from "./utils/z-order.js";
