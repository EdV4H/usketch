export {
	BASE_MAP_TYPE,
	type BaseInfo,
	type BaseMapShapeData,
} from "./base/base-map-shape.js";
export {
	type BaseRegionAnchor,
	baseIdAtWorld,
	baseRegionAnchors,
	getBaseMap,
} from "./base/base-ops.js";
export { type BaseToolState, baseStateStore, useBaseState } from "./base/base-state.js";
export { computeTerritory, type Territory } from "./base/territory.js";
// ── Territory (領域) overlay appearance — pass via `createMapPlugin({ territory })`.
export {
	DEFAULT_TERRITORY_STYLE,
	type ResolvedTerritoryStyle,
	resolveTerritoryStyle,
	type TerritoryStyle,
} from "./base/territory-style.js";
export { type BaseGenParams, baseTerrainAt, DEFAULT_BASE_GEN } from "./base-terrain.js";
export { type GenState, genStateStore, useGenState, type WorldRect } from "./gen-state.js";
// NOTE: `resolveTilemap` returns the FIRST tilemap in iteration order (or creates
// one) — NOT deterministic across synced peers when several tilemaps exist. For
// deterministic selection use `seededTilemap` / `lowestTilemap`, or the
// `enableInfiniteTerrain` API which already picks deterministically.
export { resolveTilemap } from "./generate.js";
export {
	GENERATORS,
	type GenContext,
	type GenParam,
	type MapGenerator,
} from "./generators/index.js";
export { renderIconAt } from "./icon-render.js";
export { ICONS, type IconCategory, type IconDef } from "./icons.js";
// ── Infinite base terrain public API (#946 / #937 follow-up) ──
// Enable/disable/seed the infinite base terrain from a host's own UI without the
// Control HUD. Same logic the HUD toggle runs; the seed lives on the tilemap
// shape (synced/persisted), so these take a BoardStore. Use the functions for
// imperative control, or `useInfiniteTerrain(store)` for a reactive React binding.
export {
	DEFAULT_INFINITE_SEED,
	disableInfiniteTerrain,
	type EnableInfiniteTerrainOptions,
	enableInfiniteTerrain,
	getInfiniteSeed,
	isInfiniteTerrainEnabled,
	setInfiniteSeed,
} from "./infinite-terrain.js";
// ── Host-facing service (recommended seam; #927/#946 pattern generalized) ──
// `getMapApi(app.services)?.enableInfiniteTerrain({ seed })` from a host, without
// the Control HUD and without importing individual helpers (undefined if absent).
export { createMapApi, getMapApi, type MapApi, mapService } from "./map-service.js";
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
export {
	DEFAULT_TILE,
	isTileMap,
	lowestTilemap,
	makeTileMap,
	seededTilemap,
	TILEMAP_TYPE,
	type TileMapShapeData,
} from "./tilemap-shape.js";
export {
	MAP_MODES,
	type MapMode,
	type MapToolState,
	toolStateStore,
	useMapToolState,
} from "./tool-state.js";
export {
	type InfiniteTerrainControls,
	useInfiniteTerrain,
} from "./use-infinite-terrain.js";
