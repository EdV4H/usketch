// MapLayer — renders the RPG terrain behind all shapes. Reads the tilemap
// DATA from the shape store (single source of truth, synced + undoable) and
// paints it; input is handled by the map tool, not this layer (pointer-events:none).
import {
	type BoardStore,
	type RenderMode,
	screenToOverlay,
	type Viewport,
	viewportRotation,
} from "@edv4h/usketch-shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Cells, cellKey, exposedEdges, parseCellKey } from "./autotile.js";
import {
	type BaseGenParams,
	baseTerrainAt,
	makeTerrainSampler,
	resolveBaseGen,
	type TerrainSampler,
} from "./base-terrain.js";
import { genStateStore } from "./gen-state.js";
import { blockFactor, downsampleCells, type TileDetail, tileDetail } from "./lod.js";
import { terrainCssVars } from "./palette.js";
import type { ReactiveStore } from "./reactive-store.js";
import { type MapRenderConfig, renderConfigStore } from "./render-config.js";
import { renderSvgNodes } from "./svg-nodes.js";
import { TERRAINS, type TerrainKey, terrainDarkVar, terrainPatternId } from "./terrain.js";
import { boardTilemaps, mergeTilemapCells } from "./terrain-height.js";
import { seededTilemap, type TileMapShapeData } from "./tilemap-shape.js";
import { WobbleFilter } from "./wobble-filter.js";

export const WOBBLE_FILTER_ID = "uskmap-wobble";

/**
 * Event a 3D view emits with how many screen px of ground it reveals past the viewport
 * (Mode 7 drives the background grid with it). The terrain follows, capped at
 * {@link MAX_GROUND_OVERSCAN_PX} so a huge draw distance can't explode the cell count;
 * the raised relief stays inside the window, so its edge cliffs sit on drawn ground.
 */
export const GROUND_OVERSCAN_EVENT = "bg-grid:set-overscan";
export const MAX_GROUND_OVERSCAN_PX = 160;
/**
 * Event a 3D view emits when it starts / stops showing the board (`{ active }`; Mode 7
 * does). The raised relief only means anything in 3D, so it is built only while on.
 */
export const STAGE_3D_EVENT = "usketch:stage-3d";
const GRID_PATTERN_ID = "uskmap-grid";

const EDGE_RATIO = 0.22; // dark "one shade darker" ring thickness, fraction of a tile
const EDGE_OPACITY = 0.42;
const CELL_LINE = "rgba(20,20,20,.06)";

/** Shared SVG defs: 12 terrain patterns + a per-tile grid + the wobble filter. */
function MapDefs({ tile, wobbleRegion }: { tile: number; wobbleRegion?: DOMRectReadOnly | null }) {
	return (
		<defs>
			{TERRAINS.map((t) => (
				<pattern
					key={t.key}
					id={terrainPatternId(t.key)}
					width={t.patternWidth}
					height={t.patternHeight}
					patternUnits="userSpaceOnUse"
				>
					{renderSvgNodes(t.nodes, `pat-${t.key}`)}
				</pattern>
			))}
			{/* Tile grid, matching the per-cell CELL_LINE on painted tiles, so the
			    empty-terrain background shows the same grid instead of a blank fill. */}
			<pattern id={GRID_PATTERN_ID} width={tile} height={tile} patternUnits="userSpaceOnUse">
				<rect width={tile} height={tile} fill="none" stroke={CELL_LINE} strokeWidth={1} />
			</pattern>
			<WobbleFilter id={WOBBLE_FILTER_ID} region={wobbleRegion} />
		</defs>
	);
}

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

/**
 * Full tier: per-cell pattern + autotile strips. Walks only the visible cell
 * RANGE (O(visible), not O(totalCells)) — full only runs zoomed in, so the range
 * is small even for a huge map.
 */
function renderFullCells(
	cells: Cells,
	tile: number,
	visible: DOMRectReadOnly | null | undefined,
	empty: TerrainKey | null,
): React.ReactElement[] {
	const nodes: React.ReactElement[] = [];
	const t = EDGE_RATIO * tile;
	const emit = (c: number, r: number) => {
		const terrain = cells[cellKey(c, r)];
		if (!terrain) return;
		const x = c * tile;
		const y = r * tile;
		const k = cellKey(c, r);
		nodes.push(
			<rect
				key={`${k}:base`}
				x={x}
				y={y}
				width={tile}
				height={tile}
				fill={`url(#${terrainPatternId(terrain)})`}
				stroke={CELL_LINE}
				strokeWidth={1}
			/>,
		);
		// Unset neighbours count as `empty` so painted tiles matching the empty
		// terrain (e.g. water on a water background) don't draw a spurious coast.
		const edge = exposedEdges(cells, c, r, empty);
		const dark = terrainDarkVar(terrain);
		const strip = (sx: number, sy: number, sw: number, sh: number, sk: string) => (
			<rect key={sk} x={sx} y={sy} width={sw} height={sh} fill={dark} opacity={EDGE_OPACITY} />
		);
		if (edge.n) nodes.push(strip(x, y, tile, t, `${k}:n`));
		if (edge.s) nodes.push(strip(x, y + tile - t, tile, t, `${k}:s`));
		if (edge.w) nodes.push(strip(x, y, t, tile, `${k}:w`));
		if (edge.e) nodes.push(strip(x + tile - t, y, t, tile, `${k}:e`));
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
	return nodes;
}

/**
 * Coarse tier: flat colour, cells downsampled into merged blocks. Node count is
 * bounded by the on-screen block size regardless of map size / zoom.
 */
function renderCoarseCells(
	cells: Cells,
	tile: number,
	screenTilePx: number,
	visible?: DOMRectReadOnly | null,
): React.ReactElement[] {
	const factor = blockFactor(screenTilePx);
	const bt = factor * tile;
	const nodes: React.ReactElement[] = [];
	for (const [bk, terrain] of Object.entries(downsampleCells(cells, factor))) {
		const [bc, br] = parseCellKey(bk);
		const x = bc * bt;
		const y = br * bt;
		if (culled(x, y, bt, visible)) continue;
		nodes.push(<rect key={bk} x={x} y={y} width={bt} height={bt} fill={`var(--t-${terrain})`} />);
	}
	return nodes;
}

function renderCells(
	cells: Cells,
	tile: number,
	detail: TileDetail,
	screenTilePx: number,
	visible: DOMRectReadOnly | null | undefined,
	empty: TerrainKey | null,
): React.ReactElement[] {
	if (detail === "full") return renderFullCells(cells, tile, visible, empty);
	return renderCoarseCells(cells, tile, screenTilePx, visible);
}

/**
 * Infinite base terrain, full tier. Walks the visible cell RANGE and fills EVERY
 * cell from `sample` (painted override, else generated base — always defined), so
 * unpainted space shows generated terrain. Autotile edges compare `sample`d
 * neighbours, which are total, so band borders read correctly with no gaps.
 */
function renderInfiniteFull(
	sample: TerrainSampler,
	tile: number,
	visible: DOMRectReadOnly | null | undefined,
): React.ReactElement[] {
	const range = visibleCellRange(visible, tile);
	if (!range) return [];
	const nodes: React.ReactElement[] = [];
	const t = EDGE_RATIO * tile;
	for (let r = range.r0; r <= range.r1; r++) {
		for (let c = range.c0; c <= range.c1; c++) {
			const terrain = sample(c, r);
			if (!terrain) continue;
			const x = c * tile;
			const y = r * tile;
			const k = cellKey(c, r);
			nodes.push(
				<rect
					key={`${k}:base`}
					x={x}
					y={y}
					width={tile}
					height={tile}
					fill={`url(#${terrainPatternId(terrain)})`}
					stroke={CELL_LINE}
					strokeWidth={1}
				/>,
			);
			const dark = terrainDarkVar(terrain);
			const strip = (sx: number, sy: number, sw: number, sh: number, sk: string) => (
				<rect key={sk} x={sx} y={sy} width={sw} height={sh} fill={dark} opacity={EDGE_OPACITY} />
			);
			if (sample(c, r - 1) !== terrain) nodes.push(strip(x, y, tile, t, `${k}:n`));
			if (sample(c, r + 1) !== terrain) nodes.push(strip(x, y + tile - t, tile, t, `${k}:s`));
			if (sample(c - 1, r) !== terrain) nodes.push(strip(x, y, t, tile, `${k}:w`));
			if (sample(c + 1, r) !== terrain) nodes.push(strip(x + tile - t, y, t, tile, `${k}:e`));
		}
	}
	return nodes;
}

/**
 * Infinite base terrain, coarse tier. Flat-colour blocks over the visible block
 * range sampled from the base field (bounded by on-screen blocks, not map size),
 * with painted overrides downsampled on top.
 */
function renderInfiniteCoarse(
	overrides: Cells,
	seed: number,
	tile: number,
	screenTilePx: number,
	visible: DOMRectReadOnly | null | undefined,
	gen: BaseGenParams,
): React.ReactElement[] {
	if (!visible) return [];
	const factor = blockFactor(screenTilePx);
	const bt = factor * tile;
	const half = factor >> 1;
	const nodes: React.ReactElement[] = [];
	const bc0 = Math.floor(visible.left / bt);
	const bc1 = Math.ceil(visible.right / bt) - 1;
	const br0 = Math.floor(visible.top / bt);
	const br1 = Math.ceil(visible.bottom / bt) - 1;
	for (let br = br0; br <= br1; br++) {
		for (let bc = bc0; bc <= bc1; bc++) {
			const terrain = baseTerrainAt(seed, bc * factor + half, br * factor + half, gen);
			nodes.push(
				<rect
					key={`b:${bc},${br}`}
					x={bc * bt}
					y={br * bt}
					width={bt}
					height={bt}
					fill={`var(--t-${terrain})`}
				/>,
			);
		}
	}
	// Painted overrides on top (only the edited area; bounded).
	for (const [bk, terrain] of Object.entries(downsampleCells(overrides, factor))) {
		const [bc, br] = parseCellKey(bk);
		const x = bc * bt;
		const y = br * bt;
		if (culled(x, y, bt, visible)) continue;
		nodes.push(
			<rect key={`o:${bk}`} x={x} y={y} width={bt} height={bt} fill={`var(--t-${terrain})`} />,
		);
	}
	return nodes;
}

/**
 * Visible world rect from the current viewport (best-effort, window-sized), grown by
 * `overscanPx` screen px on every side (a 3D view showing ground past the box). Under
 * camera rotation the map's layers are world overlays (turned with the world, drawn
 * with the unrotated `x/y/zoom`), so this is the square around the circle the turning
 * screen sweeps: it then depends only on where the screen is, not on the angle, so a
 * turning camera doesn't keep changing the drawn area.
 */
export function visibleWorldRect(store: BoardStore, overscanPx = 0): DOMRectReadOnly | null {
	if (typeof window === "undefined") return null;
	const vp = store.getViewport();
	const pad = 64 + Math.max(0, overscanPx);
	const w = window.innerWidth;
	const h = window.innerHeight;
	if (viewportRotation(vp) !== 0) {
		const c = screenToOverlay(w / 2, h / 2, vp);
		const cx = (c.x - vp.x) / vp.zoom;
		const cy = (c.y - vp.y) / vp.zoom;
		const r = Math.hypot(w / 2 + pad, h / 2 + pad) / vp.zoom;
		return new DOMRectReadOnly(cx - r, cy - r, 2 * r, 2 * r);
	}
	return new DOMRectReadOnly(
		(-pad - vp.x) / vp.zoom,
		(-pad - vp.y) / vp.zoom,
		(w + 2 * pad) / vp.zoom,
		(h + 2 * pad) / vp.zoom,
	);
}

/**
 * `overflow` for a map layer's root box: clipped to the layer normally, but visible
 * when the box itself turns with the camera (its corners would cut the ground) or the
 * ground is overscanned past it for a 3D view.
 */
export function layerOverflow(vp: Viewport, overscanPx = 0): "visible" | "hidden" {
	return overscanPx > 0 || viewportRotation(vp) !== 0 ? "visible" : "hidden";
}

export function MapTerrainLayer({
	store,
	renderMode,
	tile: defaultTile,
	overscan,
}: {
	store: BoardStore;
	renderMode?: RenderMode;
	/** Reference tile size for the empty-terrain background LOD. */
	tile: number;
	/** Extra screen px of ground to draw past the viewport (see `GROUND_OVERSCAN_EVENT`). */
	overscan?: ReactiveStore<{ px: number }>;
}) {
	const [, force] = useState(0);
	const rafRef = useRef(0);

	useEffect(() => {
		const rerender = () => {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = requestAnimationFrame(() => force((n) => n + 1));
		};
		const u1 = store.subscribe(rerender);
		const u2 = renderConfigStore.subscribe(rerender);
		const u3 = genStateStore.subscribe(rerender);
		const u4 = overscan?.subscribe(rerender);
		return () => {
			u1();
			u2();
			u3();
			u4?.();
			cancelAnimationFrame(rafRef.current);
		};
	}, [store, overscan]);

	const vp = store.getViewport();
	const cfg = renderConfigStore.get();
	// Only the tilemaps matter here: other shapes (a walking character) change every frame.
	const tilemaps = boardTilemaps(store);
	const overscanPx = overscan?.get().px ?? 0;
	// Drawn area: the visible rect snapped out to whole chunks, so panning inside a
	// chunk changes nothing but the wrapper's translate (see the render below).
	const visible = visibleWorldRect(store, overscanPx);
	const area = chunkArea(visible, defaultTile);
	// The wobble is redone over its whole region every frame the ground moves, so it
	// covers only what's on screen, not the larger chunk-snapped area.
	const wobbleRegion = visibleRegion(visible, defaultTile);
	const pending = genStateStore.get().pendingRect;
	const zoom = vp.zoom;
	const cssVars = terrainCssVars(cfg.colorMode, cfg.strokeScale);

	// The ground's nodes depend on the drawn area, the board's tilemaps, the render
	// config and the zoom (LOD) — not on the pan, so they're rebuilt only when one of
	// those changes and React skips the (identical) subtree on every other frame.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the area's edges
	const ground = useMemo(
		() => renderGround(tilemaps, cfg, defaultTile, zoom, renderMode, area),
		[
			tilemaps,
			cfg,
			defaultTile,
			zoom,
			renderMode,
			area?.left,
			area?.top,
			area?.width,
			area?.height,
		],
	);

	return (
		<div
			style={
				{
					position: "absolute",
					inset: 0,
					width: "100%",
					height: "100%",
					pointerEvents: "none",
					// Ground drawn past the viewport (3D overscan) must not be cut at the box.
					overflow: layerOverflow(vp, overscanPx),
					...cssVars,
				} as React.CSSProperties
			}
		>
			{/* Patterns + filters, referenced document-wide (also by the relief layer). */}
			<svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
				<MapDefs tile={defaultTile} wobbleRegion={wobbleRegion} />
			</svg>
			{area && (
				// Only this wrapper moves while panning: a plain translate the compositor
				// can apply to the already-painted ground (the filtered SVG isn't redrawn).
				<div
					style={{
						position: "absolute",
						left: 0,
						top: 0,
						transform: `translate(${vp.x + area.left * zoom}px, ${vp.y + area.top * zoom}px)`,
						willChange: "transform",
					}}
				>
					<svg
						width={area.width * zoom}
						height={area.height * zoom}
						style={{ display: "block", overflow: "visible" }}
					>
						<g transform={`scale(${zoom}) translate(${-area.left} ${-area.top})`}>
							{ground}
							{pending && (pending.w > 0 || pending.h > 0) && (
								<rect
									x={pending.x}
									y={pending.y}
									width={pending.w}
									height={pending.h}
									fill="rgba(74,127,184,.14)"
									stroke="#4A7FB8"
									strokeWidth={2}
									strokeDasharray="8 6"
									vectorEffect="non-scaling-stroke"
								/>
							)}
						</g>
					</svg>
				</div>
			)}
		</div>
	);
}

/** Chunk side, in cells: the drawn ground snaps out to this grid. */
const CHUNK_CELLS = 16;
/** Step (cells) the visible region moves in (see {@link visibleRegion}). */
const REGION_STEP_CELLS = 4;

/**
 * `rect` snapped out to multiples of `step` (world units), clipped to `within` if given.
 * A plain rect (not `new DOMRectReadOnly`) so it also works outside a browser.
 */
function snapOut(
	rect: DOMRectReadOnly,
	step: number,
	within?: DOMRectReadOnly | null,
): DOMRectReadOnly {
	let left = Math.floor(rect.left / step) * step;
	let top = Math.floor(rect.top / step) * step;
	let right = Math.ceil(rect.right / step) * step;
	let bottom = Math.ceil(rect.bottom / step) * step;
	if (within) {
		left = Math.max(left, within.left);
		top = Math.max(top, within.top);
		right = Math.max(left, Math.min(right, within.right));
		bottom = Math.max(top, Math.min(bottom, within.bottom));
	}
	const width = right - left;
	const height = bottom - top;
	return { left, top, right, bottom, x: left, y: top, width, height, toJSON: () => ({}) };
}

/** `rect` grown to whole chunks of `tile`-sized cells (null passes through). */
export function chunkArea(
	rect: DOMRectReadOnly | null | undefined,
	tile: number,
): DOMRectReadOnly | null {
	return rect ? snapOut(rect, CHUNK_CELLS * tile) : null;
}

/**
 * `rect` grown to a few cells' steps, inside the chunk area: the part of the drawn
 * ground actually on screen, for work that scales with area (the wobble filter, which
 * is redone over its whole region each frame the ground moves; the 3D relief).
 */
export function visibleRegion(
	rect: DOMRectReadOnly | null | undefined,
	tile: number,
): DOMRectReadOnly | null {
	return rect ? snapOut(rect, REGION_STEP_CELLS * tile, chunkArea(rect, tile)) : null;
}

/** The ground's SVG nodes over `area`, in world units (see MapTerrainLayer). */
function renderGround(
	tilemaps: readonly TileMapShapeData[],
	cfg: MapRenderConfig,
	defaultTile: number,
	zoom: number,
	renderMode: RenderMode | undefined,
	area: DOMRectReadOnly | null,
): React.ReactElement | null {
	if (!area) return null;

	// Empty-terrain background: fill the visible area with the fallback terrain so
	// unpainted / off-map space reads as (e.g.) sea, with painted tiles on top.
	const empty = cfg.emptyTerrain;
	const bgCoarse = tileDetail(defaultTile * zoom, renderMode) === "coarse";
	// Match painted tiles: wobble the empty background + grid too at full detail.
	const bgWobble = cfg.lineStyle === "wobble" && !bgCoarse;

	// Infinite base terrain: one pass fills the whole viewport from the base field
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
		const baseWobble = cfg.lineStyle === "wobble" && detail === "full";
		const nodes =
			detail === "full"
				? renderInfiniteFull(
						makeTerrainSampler(merged, baseSeed, empty, baseGen),
						defaultTile,
						area,
					)
				: renderInfiniteCoarse(merged, baseSeed, defaultTile, defaultTile * zoom, area, baseGen);
		return <g filter={baseWobble ? `url(#${WOBBLE_FILTER_ID})` : undefined}>{nodes}</g>;
	}

	return (
		<>
			{empty && (
				<g filter={bgWobble ? `url(#${WOBBLE_FILTER_ID})` : undefined}>
					<rect
						x={area.left}
						y={area.top}
						width={area.width}
						height={area.height}
						fill={bgCoarse ? `var(--t-${empty})` : `url(#${terrainPatternId(empty)})`}
					/>
					{!bgCoarse && (
						// Same tile grid as painted cells, so unset tiles aren't blank.
						<rect
							x={area.left}
							y={area.top}
							width={area.width}
							height={area.height}
							fill={`url(#${GRID_PATTERN_ID})`}
						/>
					)}
				</g>
			)}
			{tilemaps.map((tm) => {
				const screenTilePx = tm.tile * zoom;
				const detail = tileDetail(screenTilePx, renderMode);
				// Wobble only pays off (and is only visible) at full detail.
				const useWobble = cfg.lineStyle === "wobble" && detail === "full";
				return (
					<g key={tm.id} filter={useWobble ? `url(#${WOBBLE_FILTER_ID})` : undefined}>
						{renderCells(tm.cells, tm.tile, detail, screenTilePx, area, empty)}
					</g>
				);
			})}
		</>
	);
}
