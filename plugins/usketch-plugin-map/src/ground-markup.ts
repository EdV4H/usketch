// The ground's SVG, as markup. MapTerrainLayer sets it as a group's innerHTML instead of
// rendering an element per cell: a chunk is hundreds of rects, and building those through
// React (most of all its dev build, which records a stack per element) made bringing a
// chunk into view a long frame. Everything here is in world units. Pure.
//
// The markup is built from board data that other clients can write (tilemap cells, tile
// sizes), so only known terrain keys and finite numbers ever reach it.
import type { RenderMode } from "@edv4h/usketch-shared";
import { type Cells, cellKey, exposedEdges, parseCellKey } from "./autotile.js";
import {
	type BaseGenParams,
	baseTerrainAt,
	makeTerrainSampler,
	resolveBaseGen,
	type TerrainSampler,
} from "./base-terrain.js";
import { blockFactor, downsampleCells, tileDetail } from "./lod.js";
import type { MapRenderConfig } from "./render-config.js";
import { TERRAINS, type TerrainKey, terrainDarkVar, terrainPatternId } from "./terrain.js";
import { mergeTilemapCells } from "./terrain-height.js";
import { seededTilemap, type TileMapShapeData } from "./tilemap-shape.js";

export const WOBBLE_FILTER_ID = "uskmap-wobble";
export const GRID_PATTERN_ID = "uskmap-grid";
export const CELL_LINE = "rgba(20,20,20,.06)";
const EDGE_RATIO = 0.22; // dark "one shade darker" ring thickness, fraction of a tile
const EDGE_OPACITY = 0.42;

const KNOWN_TERRAINS: ReadonlySet<string> = new Set(TERRAINS.map((t) => t.key));

/** Whether `terrain` is one of ours (anything else is skipped, never written out). */
export function isKnownTerrain(terrain: string | null | undefined): terrain is TerrainKey {
	return terrain != null && KNOWN_TERRAINS.has(terrain);
}

function known(terrain: TerrainKey | null | undefined): TerrainKey | null {
	return isKnownTerrain(terrain) ? terrain : null;
}

/** A finite number as text (0 otherwise). */
function n(v: number): string {
	return Number.isFinite(v) ? String(v) : "0";
}

function rect(x: number, y: number, w: number, h: number, attrs: string): string {
	return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${attrs}/>`;
}

const CELL_ATTRS = (terrain: TerrainKey) =>
	`fill="url(#${terrainPatternId(terrain)})" stroke="${CELL_LINE}" stroke-width="1"`;
const STRIP_ATTRS = (terrain: TerrainKey) =>
	`fill="${terrainDarkVar(terrain)}" opacity="${EDGE_OPACITY}"`;
const FLAT_ATTRS = (terrain: TerrainKey) => `fill="var(--t-${terrain})"`;

function culled(x: number, y: number, size: number, visible?: DOMRectReadOnly | null): boolean {
	return (
		!!visible &&
		(x > visible.right || y > visible.bottom || x + size < visible.left || y + size < visible.top)
	);
}

interface CellRange {
	c0: number;
	c1: number;
	r0: number;
	r1: number;
}

/**
 * Visible cell index range (inclusive), or null when the viewport is unknown.
 * `right`/`bottom` are exclusive edges, so the end index uses `ceil - 1` — a cell
 * only counts if it actually overlaps the rect (no extra row/col on a boundary).
 */
export function visibleCellRange(
	visible: DOMRectReadOnly | null | undefined,
	tile: number,
): CellRange | null {
	if (!visible) return null;
	return {
		c0: Math.floor(visible.left / tile),
		c1: Math.ceil(visible.right / tile) - 1,
		r0: Math.floor(visible.top / tile),
		r1: Math.ceil(visible.bottom / tile) - 1,
	};
}

/** A cell's patterned base plus a darker strip on each side `edge` marks. */
function cellMarkup(
	c: number,
	r: number,
	tile: number,
	terrain: TerrainKey,
	edge: { n: boolean; s: boolean; w: boolean; e: boolean },
): string {
	const x = c * tile;
	const y = r * tile;
	const t = EDGE_RATIO * tile;
	let out = rect(x, y, tile, tile, CELL_ATTRS(terrain));
	const strip = STRIP_ATTRS(terrain);
	if (edge.n) out += rect(x, y, tile, t, strip);
	if (edge.s) out += rect(x, y + tile - t, tile, t, strip);
	if (edge.w) out += rect(x, y, t, tile, strip);
	if (edge.e) out += rect(x + tile - t, y, t, tile, strip);
	return out;
}

/**
 * Full tier: per-cell pattern + autotile strips. Walks only the visible cell
 * RANGE (O(visible), not O(totalCells)) — full only runs zoomed in, so the range
 * is small even for a huge map.
 */
function fullCellsMarkup(
	cells: Cells,
	tile: number,
	visible: DOMRectReadOnly | null | undefined,
	empty: TerrainKey | null,
): string {
	let out = "";
	const emit = (c: number, r: number) => {
		const terrain = known(cells[cellKey(c, r)]);
		if (!terrain) return;
		// Unset neighbours count as `empty` so painted tiles matching the empty
		// terrain (e.g. water on a water background) don't draw a spurious coast.
		out += cellMarkup(c, r, tile, terrain, exposedEdges(cells, c, r, empty));
	};
	const range = visibleCellRange(visible, tile);
	if (range) {
		for (let r = range.r0; r <= range.r1; r++)
			for (let c = range.c0; c <= range.c1; c++) emit(c, r);
	} else {
		for (const key of Object.keys(cells)) {
			const [c, r] = parseCellKey(key);
			emit(c, r);
		}
	}
	return out;
}

/**
 * Coarse tier: flat colour, cells downsampled into merged blocks. Node count is
 * bounded by the on-screen block size regardless of map size / zoom.
 */
function coarseCellsMarkup(
	cells: Cells,
	tile: number,
	screenTilePx: number,
	visible?: DOMRectReadOnly | null,
): string {
	const factor = blockFactor(screenTilePx);
	const bt = factor * tile;
	let out = "";
	for (const [bk, raw] of Object.entries(downsampleCells(cells, factor))) {
		const terrain = known(raw);
		if (!terrain) continue;
		const [bc, br] = parseCellKey(bk);
		const x = bc * bt;
		const y = br * bt;
		if (culled(x, y, bt, visible)) continue;
		out += rect(x, y, bt, bt, FLAT_ATTRS(terrain));
	}
	return out;
}

/**
 * Infinite base terrain, full tier. Walks the visible cell RANGE and fills EVERY
 * cell from `sample` (painted override, else generated base — always defined), so
 * unpainted space shows generated terrain. Autotile edges compare `sample`d
 * neighbours, which are total, so band borders read correctly with no gaps.
 */
function infiniteFullMarkup(
	sample: TerrainSampler,
	tile: number,
	visible: DOMRectReadOnly | null | undefined,
): string {
	const range = visibleCellRange(visible, tile);
	if (!range) return "";
	let out = "";
	for (let r = range.r0; r <= range.r1; r++) {
		for (let c = range.c0; c <= range.c1; c++) {
			const terrain = known(sample(c, r));
			if (!terrain) continue;
			out += cellMarkup(c, r, tile, terrain, {
				n: sample(c, r - 1) !== terrain,
				s: sample(c, r + 1) !== terrain,
				w: sample(c - 1, r) !== terrain,
				e: sample(c + 1, r) !== terrain,
			});
		}
	}
	return out;
}

/**
 * Infinite base terrain, coarse tier. Flat-colour blocks over the visible block
 * range sampled from the base field (bounded by on-screen blocks, not map size),
 * with painted overrides downsampled on top.
 */
function infiniteCoarseMarkup(
	overrides: Cells,
	seed: number,
	tile: number,
	screenTilePx: number,
	visible: DOMRectReadOnly | null | undefined,
	gen: BaseGenParams,
): string {
	if (!visible) return "";
	const factor = blockFactor(screenTilePx);
	const bt = factor * tile;
	const half = factor >> 1;
	let out = "";
	const bc0 = Math.floor(visible.left / bt);
	const bc1 = Math.ceil(visible.right / bt) - 1;
	const br0 = Math.floor(visible.top / bt);
	const br1 = Math.ceil(visible.bottom / bt) - 1;
	for (let br = br0; br <= br1; br++) {
		for (let bc = bc0; bc <= bc1; bc++) {
			const terrain = known(baseTerrainAt(seed, bc * factor + half, br * factor + half, gen));
			if (terrain) out += rect(bc * bt, br * bt, bt, bt, FLAT_ATTRS(terrain));
		}
	}
	// Painted overrides on top (only the edited area; bounded).
	return out + coarseCellsMarkup(overrides, tile, screenTilePx, visible);
}

/**
 * The ground's markup over `area` (world units): the generated infinite terrain when
 * the board has a seed, else the empty-terrain background with each tilemap's cells.
 */
export function groundMarkup(
	tilemaps: readonly TileMapShapeData[],
	cfg: MapRenderConfig,
	defaultTile: number,
	zoom: number,
	renderMode: RenderMode | undefined,
	area: DOMRectReadOnly | null,
): string {
	if (!area) return "";
	const wobble = (on: boolean, body: string) =>
		on ? `<g filter="url(#${WOBBLE_FILTER_ID})">${body}</g>` : `<g>${body}</g>`;

	// Empty-terrain background: fill the visible area with the fallback terrain so
	// unpainted / off-map space reads as (e.g.) sea, with painted tiles on top.
	const empty = known(cfg.emptyTerrain);
	const bgCoarse = tileDetail(defaultTile * zoom, renderMode) === "coarse";
	// Match painted tiles: wobble the empty background + grid too at full detail.
	const bgWobble = cfg.lineStyle === "wobble" && !bgCoarse;

	// Infinite base terrain: one pass fills the whole area from the base field
	// (+ painted overrides + autotile), replacing the flat empty background and the
	// per-tilemap render. The seed lives on the tilemap SHAPE (persisted + synced),
	// so the generated world survives reloads and is shared with everyone on the
	// board. Chosen deterministically (by id) so every synced client renders the
	// same world even if several seeded tilemaps coexist.
	const seededTm = seededTilemap(tilemaps);
	const baseSeed = seededTm?.baseSeed ?? null;
	if (baseSeed != null) {
		// Generation params are frozen on the shape; missing ⇒ v1 (resolveBaseGen).
		const baseGen = resolveBaseGen(seededTm?.baseGen);
		// Overrides for the sampler (several tilemaps merge deterministically by id).
		const merged: Cells = mergeTilemapCells(tilemaps);
		const detail = tileDetail(defaultTile * zoom, renderMode);
		const body =
			detail === "full"
				? infiniteFullMarkup(
						makeTerrainSampler(merged, baseSeed, empty, baseGen),
						defaultTile,
						area,
					)
				: infiniteCoarseMarkup(merged, baseSeed, defaultTile, defaultTile * zoom, area, baseGen);
		return wobble(cfg.lineStyle === "wobble" && detail === "full", body);
	}

	let out = "";
	if (empty) {
		const { left, top, width, height } = area;
		let bg = rect(
			left,
			top,
			width,
			height,
			bgCoarse ? FLAT_ATTRS(empty) : `fill="url(#${terrainPatternId(empty)})"`,
		);
		// Same tile grid as painted cells, so unset tiles aren't blank.
		if (!bgCoarse) bg += rect(left, top, width, height, `fill="url(#${GRID_PATTERN_ID})"`);
		out += wobble(bgWobble, bg);
	}
	for (const tm of tilemaps) {
		const tile = Number(tm.tile);
		if (!Number.isFinite(tile) || tile <= 0) continue;
		const screenTilePx = tile * zoom;
		const detail = tileDetail(screenTilePx, renderMode);
		// Wobble only pays off (and is only visible) at full detail.
		const body =
			detail === "full"
				? fullCellsMarkup(tm.cells, tile, area, empty)
				: coarseCellsMarkup(tm.cells, tile, screenTilePx, area);
		out += wobble(cfg.lineStyle === "wobble" && detail === "full", body);
	}
	return out;
}
