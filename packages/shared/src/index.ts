// Geometry

// Service seam (typed host-facing plugin APIs over ctx.services / app.services)
export { defineService, type ServiceHandle } from "./service.js";
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
	HudPanel,
	HudRegistry,
	HudSettingsDescriptor,
	Layer,
	LayerManager,
	LayerRenderContext,
	MarkdownConverter,
	MarkdownConverterContext,
	MarkdownConverterRegistry,
	MarkdownNode,
	MarkdownShapeSpec,
	PluginAction,
	PluginContext,
	PluginInfoRegistry,
	PluginTeardown,
	RenderTarget,
	SelectionForeground,
	SelectionForegroundRegistry,
	ServiceRegistry,
	ShapeChange,
	ShapeDefinition,
	ShapeRegistry,
	ShapeSerializeContext,
	ShortcutEntry,
	ShortcutMeta,
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
	ViewportAnimationConfig,
	ViewportAnimationOptions,
	ViewportConstraint,
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
export {
	centerOnWorld,
	easeInOutCubic,
	fitContent,
	getScreenSize,
	screenCenterWorld,
	type ViewportMoveOptions,
	zoomBy,
	zoomToLevel,
} from "./utils/viewport.js";
export {
	getShapeAABB,
	isShapeOutsideViewport,
	rectsIntersect,
	scaleRectAboutCenter,
} from "./utils/viewport-lod.js";
export { isShapeHidden, isShapeLocked } from "./utils/visibility.js";
// Z-order
export {
	compareZIndex,
	zIndexAfterAll,
	zIndexBeforeAll,
	zIndexBetween,
} from "./utils/z-order.js";
