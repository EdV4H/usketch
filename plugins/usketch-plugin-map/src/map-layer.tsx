// MapLayer — renders the RPG terrain behind all shapes. Reads the tilemap
// DATA from the shape store (single source of truth, synced + undoable) and
// paints it; input is handled by the map tool, not this layer (pointer-events:none).
import type { BoardStore, RenderMode } from "@edv4h/usketch-shared";
import { useEffect, useRef, useState } from "react";
import { type Cells, cellKey, exposedEdges, parseCellKey } from "./autotile.js";
import { baseTerrainAt, makeTerrainSampler, type TerrainSampler } from "./base-terrain.js";
import { genStateStore } from "./gen-state.js";
import { blockFactor, downsampleCells, type TileDetail, tileDetail } from "./lod.js";
import { terrainCssVars } from "./palette.js";
import { renderConfigStore } from "./render-config.js";
import { renderSvgNodes } from "./svg-nodes.js";
import { TERRAINS, type TerrainKey, terrainDarkVar, terrainPatternId } from "./terrain.js";
import { isTileMap, seededTilemap, type TileMapShapeData } from "./tilemap-shape.js";

export const WOBBLE_FILTER_ID = "uskmap-wobble";
const GRID_PATTERN_ID = "uskmap-grid";

const EDGE_RATIO = 0.22; // dark "one shade darker" ring thickness, fraction of a tile
const EDGE_OPACITY = 0.42;
const CELL_LINE = "rgba(20,20,20,.06)";

/** Shared SVG defs: 12 terrain patterns + a per-tile grid + the wobble filter. */
function MapDefs({ tile }: { tile: number }) {
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
			<filter id={WOBBLE_FILTER_ID}>
				<feTurbulence
					type="fractalNoise"
					baseFrequency="0.014"
					numOctaves="2"
					seed="7"
					result="n"
				/>
				<feDisplacementMap
					in="SourceGraphic"
					in2="n"
					scale="2.1"
					xChannelSelector="R"
					yChannelSelector="G"
				/>
			</filter>
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
			const terrain = baseTerrainAt(seed, bc * factor + half, br * factor + half);
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

/** Visible world rect from the current viewport (best-effort, window-sized). */
export function visibleWorldRect(store: BoardStore): DOMRectReadOnly | null {
	if (typeof window === "undefined") return null;
	const vp = store.getViewport();
	const pad = 64;
	const left = (-vp.x - pad) / vp.zoom;
	const top = (-vp.y - pad) / vp.zoom;
	const right = (window.innerWidth - vp.x + pad) / vp.zoom;
	const bottom = (window.innerHeight - vp.y + pad) / vp.zoom;
	return new DOMRectReadOnly(left, top, right - left, bottom - top);
}

export function MapTerrainLayer({
	store,
	renderMode,
	tile: defaultTile,
}: {
	store: BoardStore;
	renderMode?: RenderMode;
	/** Reference tile size for the empty-terrain background LOD. */
	tile: number;
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
		return () => {
			u1();
			u2();
			u3();
			cancelAnimationFrame(rafRef.current);
		};
	}, [store]);

	const vp = store.getViewport();
	const cfg = renderConfigStore.get();
	const visible = visibleWorldRect(store);
	const pending = genStateStore.get().pendingRect;

	const tilemaps: TileMapShapeData[] = [];
	for (const [, shape] of store.getShapes()) {
		if (isTileMap(shape)) tilemaps.push(shape);
	}

	const cssVars = terrainCssVars(cfg.colorMode, cfg.strokeScale);

	// Empty-terrain background: fill the visible area with the fallback terrain so
	// unpainted / off-map space reads as (e.g.) sea, with painted tiles on top.
	const empty = cfg.emptyTerrain;
	const bgCoarse = tileDetail(defaultTile * vp.zoom, renderMode) === "coarse";
	// Match painted tiles: wobble the empty background + grid too at full detail.
	const bgWobble = cfg.lineStyle === "wobble" && !bgCoarse;

	// Infinite base terrain: one pass fills the whole viewport from the base field
	// (+ painted overrides + autotile), replacing the flat empty background and the
	// per-tilemap render. The seed lives on the tilemap SHAPE (persisted + synced),
	// so the generated world survives reloads and is shared with everyone on the
	// board. Chosen deterministically (by id) so every synced client renders the
	// same world even if several seeded tilemaps coexist.
	const baseSeed = seededTilemap(tilemaps)?.baseSeed ?? null;
	const baseActive = baseSeed != null && !!visible;
	let baseNodes: React.ReactElement[] = [];
	let baseWobble = false;
	if (baseActive && visible && baseSeed != null) {
		// Overrides for the sampler. The common case is a single shared tilemap —
		// reuse its `cells` directly (read-only here) to avoid copying every RAF
		// frame; only allocate + merge when several tilemaps coexist.
		const merged: Cells =
			tilemaps.length === 1
				? tilemaps[0].cells
				: Object.assign({}, ...tilemaps.map((tm) => tm.cells));
		const detail = tileDetail(defaultTile * vp.zoom, renderMode);
		baseWobble = cfg.lineStyle === "wobble" && detail === "full";
		baseNodes =
			detail === "full"
				? renderInfiniteFull(makeTerrainSampler(merged, baseSeed, empty), defaultTile, visible)
				: renderInfiniteCoarse(merged, baseSeed, defaultTile, defaultTile * vp.zoom, visible);
	}

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				overflow: "hidden",
			}}
		>
			<svg
				width="100%"
				height="100%"
				style={{ display: "block", overflow: "visible", ...cssVars } as React.CSSProperties}
			>
				<MapDefs tile={defaultTile} />
				<g transform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}>
					{baseActive ? (
						<g filter={baseWobble ? `url(#${WOBBLE_FILTER_ID})` : undefined}>{baseNodes}</g>
					) : (
						<>
							{empty && visible && (
								<g filter={bgWobble ? `url(#${WOBBLE_FILTER_ID})` : undefined}>
									<rect
										x={visible.left}
										y={visible.top}
										width={visible.width}
										height={visible.height}
										fill={bgCoarse ? `var(--t-${empty})` : `url(#${terrainPatternId(empty)})`}
									/>
									{!bgCoarse && (
										// Same tile grid as painted cells, so unset tiles aren't blank.
										<rect
											x={visible.left}
											y={visible.top}
											width={visible.width}
											height={visible.height}
											fill={`url(#${GRID_PATTERN_ID})`}
										/>
									)}
								</g>
							)}
							{tilemaps.map((tm) => {
								const screenTilePx = tm.tile * vp.zoom;
								const detail = tileDetail(screenTilePx, renderMode);
								// Wobble only pays off (and is only visible) at full detail.
								const useWobble = cfg.lineStyle === "wobble" && detail === "full";
								return (
									<g key={tm.id} filter={useWobble ? `url(#${WOBBLE_FILTER_ID})` : undefined}>
										{renderCells(tm.cells, tm.tile, detail, screenTilePx, visible, empty)}
									</g>
								);
							})}
						</>
					)}
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
	);
}
