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
export { ElevationGroundLayer, GROUND_LAYER_ID, tileRevision } from "./elevation-layer.js";
export {
	boardElevation,
	boardField,
	DEFAULT_BASE_CACHE,
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
	removeElevationField,
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
	createElevationPlugin,
	type ElevationPluginOptions,
	GROUND_OVERSCAN_EVENT,
} from "./plugin.js";
export { registerElevationHud } from "./register-elevation-hud.js";
