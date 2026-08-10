export {
	BASE_MAP_TYPE,
	type BaseInfo,
	type BaseMapShapeData,
} from "./base/base-map-shape.js";
export { type BaseToolState, baseStateStore, useBaseState } from "./base/base-state.js";
export { computeTerritory, type Territory } from "./base/territory.js";
export { type GenState, genStateStore, useGenState, type WorldRect } from "./gen-state.js";
export {
	GENERATORS,
	type GenContext,
	type GenParam,
	type MapGenerator,
} from "./generators/index.js";
export { ICONS, type IconCategory, type IconDef } from "./icons.js";
export { MAP_ICON_TYPE, type MapIconShapeData } from "./map-icon-shape.js";
export { MAP_TOOL_ID } from "./map-tool-id.js";
export type { ColorMode } from "./palette.js";
export { createMapPlugin, type MapPluginOptions } from "./plugin.js";
export {
	type RangeEraseTargets,
	rangeEraseStore,
	useRangeEraseTargets,
} from "./range-erase-state.js";
// ── Public tool-state stores (#927) ──
// App-local reactive stores (get/set/subscribe) driving the map tool. Exported
// so hosts can build their own tool UI (ActionRing / radial picker / toolbar)
// without the Control HUD — same "public reactive store" shape as
// `renderConfigStore`. Not synced across clients (presentation/interaction state).
export type { ReactiveStore } from "./reactive-store.js";
export {
	type LineStyle,
	type MapRenderConfig,
	renderConfigStore,
} from "./render-config.js";
export { TERRAINS, type TerrainDef, type TerrainKey } from "./terrain.js";
export { DEFAULT_TILE, TILEMAP_TYPE, type TileMapShapeData } from "./tilemap-shape.js";
export {
	MAP_MODES,
	type MapMode,
	type MapToolState,
	toolStateStore,
	useMapToolState,
} from "./tool-state.js";
