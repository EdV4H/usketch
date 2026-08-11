// The `tilemap` shape is a DATA-ONLY record: it holds the painted terrain cells
// so they persist + sync (Yjs) + undo through the shape store, but it draws
// NOTHING itself — the MapLayer renders the terrain behind all shapes. It is
// locked and non-hit-testable so it never behaves as a selectable object.
import type { BoundingBox, ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { type Cells, cellKey, cellsBounds, parseCellKey } from "./autotile.js";
import type { TerrainKey } from "./terrain.js";

export const TILEMAP_TYPE = "tilemap";
export const DEFAULT_TILE = 40;

export interface TileMapShapeData extends ShapeData {
	type: "tilemap";
	tile: number;
	cells: Cells;
	/**
	 * Cells the user HAND-painted (brush / fill / region), as opposed to cells
	 * laid down by the generator. Base territory only expands through hand-painted
	 * land (so a generated continent isn't auto-claimed). Sparse; keys mirror a
	 * subset of `cells`.
	 */
	handPaint?: Record<string, true>;
	/**
	 * Seed for the infinite procedurally-generated base terrain. When set, every
	 * unpainted cell is filled by `baseTerrainAt(baseSeed, col, row)`. Stored on the
	 * shape (not app-local render config) so the generated world **persists across
	 * reloads and syncs to everyone** on the board. `undefined` = no base.
	 */
	baseSeed?: number;
}

export function isTileMap(shape: ShapeData): shape is TileMapShapeData {
	return shape.type === TILEMAP_TYPE;
}

/**
 * The tilemap that owns the infinite-terrain seed, chosen **deterministically**
 * (lowest `id`) so every synced client resolves the same seed even if several
 * seeded tilemaps coexist — `getShapes()` insertion order is not guaranteed
 * identical across peers, so we must not rely on "first found". Returns `null`
 * when no tilemap carries a seed.
 */
export function seededTilemap(shapes: Iterable<ShapeData>): TileMapShapeData | null {
	let best: TileMapShapeData | null = null;
	// Require an INTEGER seed (step:1): synced shape data could carry NaN/Infinity
	// (→ HUD garbage, `fbm(NaN, …)` behaves as seed 0) or a fraction like 1.9,
	// which the HUD shows verbatim but `hash2` truncates to 1 via ToInt32 — the
	// two would disagree. Integer-only keeps the display and the effective seed in
	// sync.
	for (const s of shapes)
		if (
			isTileMap(s) &&
			s.baseSeed != null &&
			Number.isInteger(s.baseSeed) &&
			(best === null || s.id < best.id)
		)
			best = s;
	return best;
}

/**
 * The lowest-`id` tilemap on the board (of any kind), or `null` if there are
 * none. Used to pick a **deterministic** stamp target when enabling the infinite
 * base — `resolveTilemap`'s "first in insertion order" isn't stable across synced
 * clients, so two peers could otherwise seed different tilemaps.
 */
export function lowestTilemap(shapes: Iterable<ShapeData>): TileMapShapeData | null {
	let best: TileMapShapeData | null = null;
	for (const s of shapes) if (isTileMap(s) && (best === null || s.id < best.id)) best = s;
	return best;
}

/** Create a new empty tilemap (locked substrate). */
export function makeTileMap(tile: number): TileMapShapeData {
	const bounds = { x: 0, y: 0, width: 0, height: 0 };
	return {
		id: generateId(),
		type: "tilemap",
		x: bounds.x,
		y: bounds.y,
		width: bounds.width,
		height: bounds.height,
		style: { fill: "transparent", stroke: "transparent", strokeWidth: 0, opacity: 1 },
		tile,
		cells: {},
		handPaint: {},
		locked: true,
	};
}

/** Bounds patch to keep x/y/width/height in sync with the painted cells. */
export function boundsPatch(cells: Cells, tile: number): BoundingBox {
	return cellsBounds(cells, tile);
}

export function createTileMapShapeDefinition(tile: number = DEFAULT_TILE): ShapeDefinition {
	return {
		// Drawing is done by the MapLayer; the shape itself renders nothing.
		render: () => <g />,
		renderTarget: "svg",
		getBounds: (data): BoundingBox => {
			const d = data as TileMapShapeData;
			return cellsBounds(d.cells ?? {}, d.tile ?? tile);
		},
		// Never selectable via pointer — it is a substrate, not an object.
		hitTest: () => false,
		resizable: false,
		resize: (data): ShapeData => data,
		createDefault: (params): ShapeData => ({
			...makeTileMap(tile),
			id: params.id,
		}),
		// Locked, so user-move is not expected; support it anyway by shifting cells
		// on whole-tile deltas (keeps the grid aligned).
		move: (data, dx, dy): Partial<ShapeData> => {
			const d = data as TileMapShapeData;
			const t = d.tile ?? tile;
			const dc = Math.round(dx / t);
			const dr = Math.round(dy / t);
			if (dc === 0 && dr === 0) return {};
			const next: Cells = {};
			for (const [key, terrain] of Object.entries(d.cells)) {
				const [c, r] = parseCellKey(key);
				next[cellKey(c + dc, r + dr)] = terrain;
			}
			return { cells: next, ...cellsBounds(next, t) } as Partial<ShapeData>;
		},
		serializeForAi: (data): Record<string, unknown> => {
			const d = data as TileMapShapeData;
			const used = new Set<TerrainKey>(Object.values(d.cells ?? {}));
			return {
				kind: "tilemap",
				tileCount: Object.keys(d.cells ?? {}).length,
				terrains: [...used],
			};
		},
		debugFields: (data): Record<string, unknown> => {
			const d = data as TileMapShapeData;
			return { tile: d.tile, cellCount: Object.keys(d.cells ?? {}).length };
		},
	};
}
