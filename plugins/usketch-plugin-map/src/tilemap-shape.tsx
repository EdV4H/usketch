// The `tilemap` shape is a DATA-ONLY record: it holds the painted terrain cells
// so they persist + sync (Yjs) + undo through the shape store, but it draws
// NOTHING itself — the MapLayer renders the terrain behind all shapes. It is
// locked and non-hit-testable so it never behaves as a selectable object.
import type { BoundingBox, ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import { generateId } from "@edv4h/usketch-shared";
import { type Cells, cellKey, type IconCells, keysBounds, parseCellKey } from "./autotile.js";
import type { BaseGenParams } from "./base-terrain.js";
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
	/**
	 * Generation version + parameters the base terrain was created with, recorded
	 * so the board's world is **frozen**: tuning the defaults or changing the
	 * algorithm later won't retroactively alter existing boards. `undefined` on an
	 * older seeded shape means v1 (see `resolveBaseGen`). Paired with `baseSeed`.
	 */
	baseGen?: BaseGenParams;
	/**
	 * World-layer icons as GRID DATA: `cellKey("c,r") → iconKey` (one icon per
	 * cell). Like `cells`, this lives on the substrate shape — so placed icons
	 * are part of the protected world layer: the generic Select tool can't grab
	 * them (they aren't shapes), while the Map tool (stamp / eraser) edits them
	 * directly. Persists + syncs + undoes through the shape store. Sparse.
	 */
	icons?: IconCells;
}

export function isTileMap(shape: ShapeData): shape is TileMapShapeData {
	return shape.type === TILEMAP_TYPE;
}

/**
 * Bounds patch keeping x/y/width/height in sync with BOTH painted cells and placed
 * icons — an icon-only cell outside the painted area still counts, so the box
 * encloses everything the tilemap owns.
 */
export function tilemapBounds(
	cells: Cells,
	icons: IconCells | undefined,
	tile: number,
): BoundingBox {
	const keys = icons ? [...Object.keys(cells), ...Object.keys(icons)] : Object.keys(cells);
	return keysBounds(keys, tile);
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
		icons: {},
		handPaint: {},
		locked: true,
	};
}

export function createTileMapShapeDefinition(tile: number = DEFAULT_TILE): ShapeDefinition {
	return {
		// Drawing is done by the MapLayer; the shape itself renders nothing.
		render: () => <g />,
		renderTarget: "svg",
		getBounds: (data): BoundingBox => {
			const d = data as TileMapShapeData;
			return tilemapBounds(d.cells ?? {}, d.icons, d.tile ?? tile);
		},
		// Never selectable via pointer — it is a substrate, not an object.
		hitTest: () => false,
		resizable: false,
		resize: (data): ShapeData => data,
		createDefault: (params): ShapeData => ({
			...makeTileMap(tile),
			id: params.id,
		}),
		// Locked, so user-move is not expected; support it anyway by shifting every
		// grid (cells / icons / handPaint) by the same whole-tile delta so they stay
		// aligned — handPaint keys mirror `cells` and territory expansion keys off it,
		// so it must move too.
		move: (data, dx, dy): Partial<ShapeData> => {
			const d = data as TileMapShapeData;
			const t = d.tile ?? tile;
			const dc = Math.round(dx / t);
			const dr = Math.round(dy / t);
			if (dc === 0 && dr === 0) return {};
			const shift = (key: string): string => {
				const [c, r] = parseCellKey(key);
				return cellKey(c + dc, r + dr);
			};
			const next: Cells = {};
			for (const [key, terrain] of Object.entries(d.cells)) next[shift(key)] = terrain;
			const nextIcons: IconCells = {};
			for (const [key, iconKey] of Object.entries(d.icons ?? {})) nextIcons[shift(key)] = iconKey;
			const nextHandPaint: Record<string, true> = {};
			for (const key of Object.keys(d.handPaint ?? {})) nextHandPaint[shift(key)] = true;
			return {
				cells: next,
				icons: nextIcons,
				handPaint: nextHandPaint,
				...tilemapBounds(next, nextIcons, t),
			} as Partial<ShapeData>;
		},
		serializeForAi: (data): Record<string, unknown> => {
			const d = data as TileMapShapeData;
			const used = new Set<TerrainKey>(Object.values(d.cells ?? {}));
			return {
				kind: "tilemap",
				tileCount: Object.keys(d.cells ?? {}).length,
				iconCount: Object.keys(d.icons ?? {}).length,
				terrains: [...used],
			};
		},
		debugFields: (data): Record<string, unknown> => {
			const d = data as TileMapShapeData;
			return {
				tile: d.tile,
				cellCount: Object.keys(d.cells ?? {}).length,
				iconCount: Object.keys(d.icons ?? {}).length,
			};
		},
	};
}
