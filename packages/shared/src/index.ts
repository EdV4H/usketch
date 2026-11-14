// The board's height (ground + solid providers)
export {
	type BoardHeightApi,
	boardHeight,
	boardHeightService,
	createBoardHeight,
	type HeightKind,
	type HeightProvider,
} from "./board-height.js";
// Ground decals (things painted onto the ground surface, e.g. by a terrain renderer)
export {
	ALL_GROUND_DECAL_VIEWS,
	createGroundDecalRegistry,
	decalRectsMeet,
	type GroundDecal,
	type GroundDecalApi,
	type GroundDecalArea,
	type GroundDecalEntry,
	type GroundDecalRect,
	type GroundDecalView,
	groundDecalService,
	groundDecals,
} from "./ground-decal.js";
// Ground height (terrain elevation shared across plugins)
export { type GroundHeightApi, groundHeightService } from "./ground-height.js";
// Board history (content-addressed snapshots, diff, restore)
export { canonicalJson } from "./history/canonical-json.js";
export type { ShapeFieldChange, TreeDiff } from "./history/diff.js";
export { diffShapeFields, diffTrees } from "./history/diff.js";
export type { HistoryObjectKind } from "./history/hash.js";
export { hashHistoryObject } from "./history/hash.js";
export type {
	BoardSnapshot,
	HistoryCommit,
	HistoryCommitTrigger,
	HistoryObject,
	HistoryTreeEntries,
	ShapeCollection,
} from "./history/objects.js";
export {
	createBlob,
	createCommit,
	createTree,
	HISTORY_EXCLUDED_SHAPE_KEYS,
	normalizeShapeForHistory,
	parseBlob,
	parseCommit,
	parseTree,
	shapeEntries,
	snapshotShapes,
} from "./history/objects.js";
export type { RestoreOptions, RestorePlan } from "./history/restore.js";
export {
	applyRestorePlan,
	createRestoreCommand,
	isEmptyRestorePlan,
	planRestore,
} from "./history/restore.js";
// 3D view state (Mode 7 etc.) shared across plugins
export {
	type GroundProjection,
	type GroundRayOptions,
	type Mat4,
	type ProjectionCamera,
	projectStagePoint,
	projectWorld,
	type StageSize,
	type TiltCss,
	tiltCss,
	tiltOrigin,
	unprojectOnGround,
	unprojectStagePoint,
	unprojectWorld,
	type View3dProjection,
	viewMatrix,
} from "./projection-3d.js";
// Service seam (typed host-facing plugin APIs over ctx.services / app.services)
export { defineService, type ServiceHandle } from "./service.js";
// The solids 3D shapes make on the ground (a solid provider on the board's height)
export {
	areaContains,
	buildColliderIndex,
	COLLIDER_CELL,
	type ColliderArea,
	type ColliderIndex,
	colliderFor,
	createShapeSolids,
	MIN_STAND_RADIUS,
	SHAPE_SOLIDS_PROVIDER_ID,
	type ShapeSolidsApi,
	type ShapeSolidsOptions,
	type ShapeView3dCollider,
	STAND_WALL_THICKNESS,
	shapeSolidsService,
	shapeView3dAnchor,
	shapeView3dFoot,
	solidHeightAt,
} from "./shape-solids.js";
// A shape's 3D look (ShapeData.view3d) and a shape type's (ShapeDefinition.view3d)
export {
	DEFAULT_SHAPE_VIEW_3D,
	DEFAULT_VIEW_3D_HEIGHT,
	DEFAULT_VIEW_3D_TYPE_MODES,
	LEGACY_SHAPE_VIEW_3D_KEY,
	MAX_VIEW_3D_HEIGHT,
	normalizeShapeView3d,
	rawShapeView3d,
	readShapeView3d,
	resolveShapeView3d,
	SHAPE_VIEW_3D_COLLISIONS,
	SHAPE_VIEW_3D_MODES,
	type ShapeTypeView3d,
	type ShapeView3d,
	type ShapeView3dCollision,
	type ShapeView3dFacing,
	type ShapeView3dInput,
	type ShapeView3dMode,
	type ShapeView3dRender,
	type ShapeView3dRenderContext,
	shapeTypeModes,
	shapeView3dCollision,
	shapeView3dPatch,
	storedShapeView3d,
	VIEW_3D_COLLISIONS_BY_MODE,
} from "./shape-view-3d.js";
// Solid height (what stands on the ground, e.g. raised shapes)
export { type SolidHeightApi, solidHeightService } from "./solid-height.js";
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
	HudPanel,
	HudRegistry,
	HudSettingsDescriptor,
	KeyBinding,
	KeyBindingKind,
	KeyBindingSpec,
	KeyConflict,
	KeyConflictPolicy,
	KeyGate,
	Keymap,
	Layer,
	LayerExportBackgroundContext,
	LayerManager,
	LayerRenderContext,
	LayerView3d,
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
	SelectionHandle,
	SelectionHandleDrag,
	SelectionHandleProvider,
	SelectionHandleRegistry,
	SelectionHandleRenderContext,
	SelectionHandleState,
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
export { DEFAULT_SELECTION_HANDLE_HIT_RADIUS } from "./types/plugin.js";
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
	overlayFrameStyle,
	screenRectToWorldBounds,
	screenToOverlay,
	screenToWorld,
	unrotatedViewport,
	viewportAnchoredAt,
	viewportRotation,
	viewportTransformStyle,
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
	shortestAngleDelta,
	snapAngle,
	unrotatePoint,
	withRotation,
	wrapDeg,
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
export { isShapeHidden, isShapeLockCascading, isShapeLocked } from "./utils/visibility.js";
// Z-order
export {
	compareZIndex,
	zIndexAfterAll,
	zIndexBeforeAll,
	zIndexBetween,
} from "./utils/z-order.js";
export { type View3dApi, type View3dCamera, view3dService } from "./view-3d.js";
export {
	CAMERA_3D_LIMITS,
	type Camera3d,
	clampCamera3d,
	clampDrawDistance,
	createView3dCell,
	DEFAULT_CAMERA_3D,
	DEFAULT_DRAW_DISTANCE,
	FLAT_VIEW_3D,
	OVERSCAN_BUFFER_PX,
	patchView3d,
	sameView3d,
	type View3dCell,
	type View3dPatch,
	type View3dState,
	view3dCellOf,
	view3dOverscanPx,
} from "./view-3d-state.js";
