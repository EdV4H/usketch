// MapLayer — renders the RPG terrain behind all shapes. Reads the tilemap
// DATA from the shape store (single source of truth, synced + undoable) and
// paints it; input is handled by the map tool, not this layer (pointer-events:none).
import type { BoardStore, RenderMode } from "@edv4h/usketch-shared";
import { useEffect, useRef, useState } from "react";
import { type Cells, exposedEdges, parseCellKey } from "./autotile.js";
import { genStateStore } from "./gen-state.js";
import { blockFactor, downsampleCells, type TileDetail, tileDetail } from "./lod.js";
import { terrainCssVars } from "./palette.js";
import { renderConfigStore } from "./render-config.js";
import { renderSvgNodes } from "./svg-nodes.js";
import { TERRAINS, type TerrainKey, terrainDarkVar, terrainPatternId } from "./terrain.js";
import { isTileMap, type TileMapShapeData } from "./tilemap-shape.js";

export const WOBBLE_FILTER_ID = "uskmap-wobble";

const EDGE_RATIO = 0.22; // dark "one shade darker" ring thickness, fraction of a tile
const EDGE_OPACITY = 0.42;
const CELL_LINE = "rgba(20,20,20,.06)";

/** Shared SVG defs: 12 terrain patterns + the hand-drawn wobble filter. */
function MapDefs() {
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

/** Low tier: flat-colour, cells downsampled into merged blocks (fewest nodes). */
function renderLowCells(
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

/** Full/mid tiers: per-cell pattern fill; full adds autotile edge strips + separators. */
function renderPatternCells(
	cells: Cells,
	tile: number,
	full: boolean,
	visible?: DOMRectReadOnly | null,
): React.ReactElement[] {
	const nodes: React.ReactElement[] = [];
	for (const [key, terrain] of Object.entries(cells)) {
		const [c, r] = parseCellKey(key);
		const x = c * tile;
		const y = r * tile;
		if (culled(x, y, tile, visible)) continue;
		const pat = `url(#${terrainPatternId(terrain as TerrainKey)})`;
		nodes.push(
			<rect
				key={`${key}:base`}
				x={x}
				y={y}
				width={tile}
				height={tile}
				fill={pat}
				stroke={full ? CELL_LINE : undefined}
				strokeWidth={full ? 1 : undefined}
			/>,
		);
		if (!full) continue;
		const edge = exposedEdges(cells, c, r);
		const t = EDGE_RATIO * tile;
		const dark = terrainDarkVar(terrain as TerrainKey);
		const strip = (sx: number, sy: number, sw: number, sh: number, k: string) => (
			<rect key={k} x={sx} y={sy} width={sw} height={sh} fill={dark} opacity={EDGE_OPACITY} />
		);
		if (edge.n) nodes.push(strip(x, y, tile, t, `${key}:n`));
		if (edge.s) nodes.push(strip(x, y + tile - t, tile, t, `${key}:s`));
		if (edge.w) nodes.push(strip(x, y, t, tile, `${key}:w`));
		if (edge.e) nodes.push(strip(x + tile - t, y, t, tile, `${key}:e`));
	}
	return nodes;
}

function renderCells(
	cells: Cells,
	tile: number,
	detail: TileDetail,
	screenTilePx: number,
	visible?: DOMRectReadOnly | null,
): React.ReactElement[] {
	if (detail === "low") return renderLowCells(cells, tile, screenTilePx, visible);
	return renderPatternCells(cells, tile, detail === "full", visible);
}

/** Visible world rect from the current viewport (best-effort, window-sized). */
function visibleWorldRect(store: BoardStore): DOMRectReadOnly | null {
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
}: {
	store: BoardStore;
	renderMode?: RenderMode;
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
				<MapDefs />
				<g transform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}>
					{tilemaps.map((tm) => {
						const screenTilePx = tm.tile * vp.zoom;
						const detail = tileDetail(screenTilePx, renderMode);
						// Wobble only pays off (and is only visible) at full detail.
						const useWobble = cfg.lineStyle === "wobble" && detail === "full";
						return (
							<g key={tm.id} filter={useWobble ? `url(#${WOBBLE_FILTER_ID})` : undefined}>
								{renderCells(tm.cells, tm.tile, detail, screenTilePx, visible)}
							</g>
						);
					})}
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
