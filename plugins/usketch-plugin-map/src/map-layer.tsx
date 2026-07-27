// MapLayer — renders the RPG terrain behind all shapes. Reads the tilemap
// DATA from the shape store (single source of truth, synced + undoable) and
// paints it; input is handled by the map tool, not this layer (pointer-events:none).
import type { BoardStore } from "@edv4h/usketch-shared";
import { useEffect, useRef, useState } from "react";
import { type Cells, exposedEdges, parseCellKey } from "./autotile.js";
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

interface CellRects {
	nodes: React.ReactElement[];
}

function renderCells(cells: Cells, tile: number, visible?: DOMRectReadOnly | null): CellRects {
	const nodes: React.ReactElement[] = [];
	for (const [key, terrain] of Object.entries(cells)) {
		const [c, r] = parseCellKey(key);
		const x = c * tile;
		const y = r * tile;
		if (
			visible &&
			(x > visible.right || y > visible.bottom || x + tile < visible.left || y + tile < visible.top)
		) {
			continue; // simple viewport cull
		}
		const pat = `url(#${terrainPatternId(terrain as TerrainKey)})`;
		nodes.push(
			<rect
				key={`${key}:base`}
				x={x}
				y={y}
				width={tile}
				height={tile}
				fill={pat}
				stroke={CELL_LINE}
				strokeWidth={1}
			/>,
		);
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
	return { nodes };
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

export function MapTerrainLayer({ store }: { store: BoardStore }) {
	const [, force] = useState(0);
	const rafRef = useRef(0);

	useEffect(() => {
		const rerender = () => {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = requestAnimationFrame(() => force((n) => n + 1));
		};
		const u1 = store.subscribe(rerender);
		const u2 = renderConfigStore.subscribe(rerender);
		return () => {
			u1();
			u2();
			cancelAnimationFrame(rafRef.current);
		};
	}, [store]);

	const vp = store.getViewport();
	const cfg = renderConfigStore.get();
	const visible = visibleWorldRect(store);

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
				<g
					transform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}
					filter={cfg.lineStyle === "wobble" ? `url(#${WOBBLE_FILTER_ID})` : undefined}
				>
					{tilemaps.map((tm) => (
						<g key={tm.id}>{renderCells(tm.cells, tm.tile, visible).nodes}</g>
					))}
				</g>
			</svg>
		</div>
	);
}
