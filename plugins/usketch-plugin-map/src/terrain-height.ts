// Terrain height (高さ): every cell stands at a LEVEL derived from its terrain type —
// sea at 0, ordinary land one step up, stone / mountain / snow higher still — so the
// generated world (whose bands already come from an elevation field) gets its relief
// for free, with no extra data. The relief layer draws the levels as cliffs in 3D
// (Mode 7), and the board's ground-height service reports them so a character can't
// climb a cliff taller than its step.
import type { BoardStore } from "@edv4h/usketch-shared";
import { type Cells, worldToCell } from "./autotile.js";
import { makeTerrainSampler, resolveBaseGen, type TerrainSampler } from "./base-terrain.js";
import { renderConfigStore } from "./render-config.js";
import type { TerrainKey } from "./terrain.js";
import { isTileMap, seededTilemap, type TileMapShapeData } from "./tilemap-shape.js";

/** World units per level. */
export const LEVEL_HEIGHT = 16;

/** Level of each terrain type (0 = sea level). */
export const TERRAIN_LEVELS: Readonly<Record<TerrainKey, number>> = {
	water: 0,
	swamp: 0,
	sand: 1,
	grass: 1,
	farm: 1,
	flower: 1,
	path: 1,
	forest: 1,
	lava: 1,
	stone: 2,
	mtn: 3,
	snow: 4,
};

/** Level of a terrain (0 for unset cells). */
export function terrainLevel(terrain: TerrainKey | undefined): number {
	return terrain ? (TERRAIN_LEVELS[terrain] ?? 0) : 0;
}

/**
 * The painted cells of every tilemap, merged. The common case is a single shared
 * tilemap — its `cells` are reused directly (read-only); several are merged in id
 * order so overlapping cells resolve deterministically (highest id wins), since
 * insertion order isn't consistent across synced clients.
 */
export function mergeTilemapCells(tilemaps: readonly TileMapShapeData[]): Cells {
	if (tilemaps.length === 1) return tilemaps[0].cells;
	return Object.assign(
		{},
		...[...tilemaps].sort((a, b) => (a.id < b.id ? -1 : 1)).map((tm) => tm.cells),
	);
}

const tilemapCache = new WeakMap<
	BoardStore,
	{ shapes: ReturnType<BoardStore["getShapes"]>; tilemaps: readonly TileMapShapeData[] }
>();

/**
 * The board's tilemap shapes, as the same array for as long as none of them changes.
 * Other shapes (a walking character, a sticky being dragged) replace the shapes map
 * every frame; keying the terrain's caches on this instead keeps them warm through that.
 */
export function boardTilemaps(store: BoardStore): readonly TileMapShapeData[] {
	const shapes = store.getShapes();
	const hit = tilemapCache.get(store);
	if (hit && hit.shapes === shapes) return hit.tilemaps;
	const next: TileMapShapeData[] = [];
	for (const [, shape] of shapes) {
		if (isTileMap(shape)) next.push(shape);
	}
	const prev = hit?.tilemaps;
	const same = prev && prev.length === next.length && prev.every((tm, i) => tm === next[i]);
	const tilemaps = same ? prev : next;
	tilemapCache.set(store, { shapes, tilemaps });
	return tilemaps;
}

interface CachedSampler {
	tilemaps: readonly TileMapShapeData[];
	config: ReturnType<typeof renderConfigStore.get>;
	sampler: TerrainSampler;
}
const samplerCache = new WeakMap<BoardStore, CachedSampler>();

/**
 * The board's terrain at any cell: painted override, else generated base, else empty.
 * Cached per store until a tilemap or the render config changes (both are replaced,
 * never mutated, on update): the character samples it several times a frame.
 */
export function boardTerrainSampler(store: BoardStore): TerrainSampler {
	const tilemaps = boardTilemaps(store);
	const config = renderConfigStore.get();
	const hit = samplerCache.get(store);
	if (hit && hit.tilemaps === tilemaps && hit.config === config) return hit.sampler;
	const sampler = buildSampler(tilemaps);
	samplerCache.set(store, { tilemaps, config, sampler });
	return sampler;
}

function buildSampler(tilemaps: readonly TileMapShapeData[]): TerrainSampler {
	const seeded = seededTilemap(tilemaps);
	return makeTerrainSampler(
		mergeTilemapCells(tilemaps),
		seeded?.baseSeed ?? null,
		renderConfigStore.get().emptyTerrain,
		resolveBaseGen(seeded?.baseGen),
	);
}

/** Ground height (world units) at a world point on the board. */
export function groundHeightAt(store: BoardStore, x: number, y: number, tile: number): number {
	const [c, r] = worldToCell(x, y, tile);
	return terrainLevel(boardTerrainSampler(store)(c, r)) * LEVEL_HEIGHT;
}
