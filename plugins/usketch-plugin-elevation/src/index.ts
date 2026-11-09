export { BRUSH_CURSOR_LAYER_ID, BrushCursorLayer } from "./brush-cursor-layer.js";
export {
	applyDab,
	applyDabs,
	BRUSH_FALLOFFS,
	BRUSH_MODES,
	type BrushFalloff,
	type BrushMode,
	type BrushSettings,
	beginStroke,
	type ChunkChange,
	type DabOptions,
	DEFAULT_BRUSH,
	dabsAlong,
	falloffWeight,
	MAX_RADIUS,
	MIN_RADIUS,
	normalizeBrush,
	RAISE_RATE,
	type Stroke,
	strokeChanges,
} from "./elevation-brush.js";
export { decodeChunk, encodeChunk, isEmptyChunk } from "./elevation-codec.js";
export {
	CHUNK_TYPE,
	chunkKey,
	chunkShapeId,
	DEFAULT_CHUNK,
	DEFAULT_GEN,
	DEFAULT_SPACING,
	DEFAULT_WATER_RATIO,
	DELTA_SCALE,
	type ElevationChunkShape,
	type ElevationFieldConfig,
	type ElevationFieldShape,
	type ElevationGenParams,
	FIELD_TYPE,
	isElevationChunk,
	isElevationField,
	MAX_HEIGHT,
	makeChunkShape,
	makeFieldShape,
	normalizeField,
	normalizeGen,
} from "./elevation-field.js";
export {
	ElevationGroundLayer,
	GROUND_LAYER_ID,
	STROKE_TILE_PX,
	type StrokePreview,
	tileRevision,
} from "./elevation-layer.js";
export {
	buildTileMesh,
	type MeshCamera,
	projectLifted,
	RAMP_WIDTH,
	rampPixels,
	rampRange,
	tileIndices,
	VERTEX_FLOATS,
} from "./elevation-mesh.js";
export { ElevationMeshLayer, MESH_LAYER_ID, type MeshState } from "./elevation-mesh-layer.js";
export {
	boardElevation,
	boardField,
	DEFAULT_BASE_CACHE,
	type DeltaValues,
	type ElevationModel,
	type ElevationSampler,
	elevationHeightAt,
	elevationSampler,
	setBaseCacheLimit,
} from "./elevation-model.js";
export { baseHeight, gradientNoise, hash2 } from "./elevation-noise.js";
export {
	clearElevationEdits,
	DEFAULT_ELEVATION_SEED,
	disableInfiniteElevation,
	ELEVATION_FIELD_ID,
	type ElevationDeps,
	type EnableElevationOptions,
	editedChunkCount,
	enableInfiniteElevation,
	getElevationField,
	type PaintOptions,
	paintElevation,
	removeElevationField,
	writeChunkEdits,
} from "./elevation-ops.js";
export {
	createElevationApi,
	type ElevationApi,
	elevationService,
	getElevationApi,
} from "./elevation-service.js";
export {
	DEFAULT_DISPLAY,
	type ElevationDisplay,
	heightColor,
	renderTilePixels,
	shadeFactor,
	type TileRequest,
} from "./elevation-shade.js";
export {
	MAX_LEVEL,
	MAX_TILES,
	MIN_TILE_PX,
	planTiles,
	type TilePlan,
	tileBitmapPx,
	tileWorldSize,
	visibleWorldRect,
	type WorldRect,
} from "./elevation-tiles.js";
export {
	type BrushCursor,
	createElevationToolDefinition,
	ELEVATION_TOOL_ID,
	type ElevationToolDeps,
} from "./elevation-tool.js";
export {
	createElevationPlugin,
	DEFAULT_GROUND_ORDER,
	DEFAULT_MESH_ORDER,
	type ElevationPluginOptions,
	GROUND_OVERSCAN_EVENT,
} from "./plugin.js";
export { registerElevationHud } from "./register-elevation-hud.js";
