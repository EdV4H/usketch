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

interface CachedSampler {
	shapes: ReturnType<BoardStore["getShapes"]>;
	config: ReturnType<typeof renderConfigStore.get>;
	sampler: TerrainSampler;
}
const samplerCache = new WeakMap<BoardStore, CachedSampler>();

/**
 * The board's terrain at any cell: painted override, else generated base, else empty.
 * Cached per store until the shapes map or the render config changes (both are
 * replaced, never mutated, on update): the character samples it several times a frame.
 */
export function boardTerrainSampler(store: BoardStore): TerrainSampler {
	const shapes = store.getShapes();
	const config = renderConfigStore.get();
	const hit = samplerCache.get(store);
	if (hit && hit.shapes === shapes && hit.config === config) return hit.sampler;
	const sampler = buildSampler(store);
	samplerCache.set(store, { shapes, config, sampler });
	return sampler;
}

function buildSampler(store: BoardStore): TerrainSampler {
	const tilemaps: TileMapShapeData[] = [];
	for (const [, shape] of store.getShapes()) {
		if (isTileMap(shape)) tilemaps.push(shape);
	}
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
