// MapReliefLayer — the terrain's height in 3D. Cells above sea level get their
// terrain repainted as a top face lifted to their level (one SVG per level), and a
// cliff wall stands on every edge where the neighbour is lower. Only a 3D view gives
// those depths meaning, so the layer is shown under the Mode 7 stage only (the flat
// board already shows the same terrain in MapTerrainLayer) and is meant to be one of
// Mode 7's depth layers.
import type { BoardStore, RenderMode, Viewport } from "@edv4h/usketch-shared";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { cellKey } from "./autotile.js";
import type { TerrainSampler } from "./base-terrain.js";
import { tileDetail } from "./lod.js";
import { visibleCellRange, visibleWorldRect } from "./map-layer.js";
import { terrainCssVars } from "./palette.js";
import { renderConfigStore } from "./render-config.js";
import { type TerrainKey, terrainDarkVar, terrainPatternId } from "./terrain.js";
import { boardTerrainSampler, LEVEL_HEIGHT, terrainLevel } from "./terrain-height.js";

export const RELIEF_LAYER_ID = "usketch-map:relief";

const CELL_LINE = "rgba(20,20,20,.06)";
/** Cells left flat along the edge of the drawn terrain (see the render). */
const EDGE_INSET = 2;
/** Shown only while the Mode 7 stage is on (the attribute it sets on the canvas). */
const STAGE_CSS = '[data-mode7-stage="on"] [data-uskmap-relief]{display:block !important}';

export interface ReliefTop {
	key: string;
	col: number;
	row: number;
	terrain: TerrainKey;
}

export interface ReliefWall {
	key: string;
	col: number;
	row: number;
	side: "n" | "s" | "w" | "e";
	/** Level of the higher (owning) cell — the wall's top. */
	top: number;
	/** Level of the lower neighbour — the wall's foot. */
	bottom: number;
	terrain: TerrainKey;
}

export interface Relief {
	/** Raised cells grouped by level (level ≥ 1). */
	tops: Map<number, ReliefTop[]>;
	walls: ReliefWall[];
}

const NEIGHBOURS = [
	["n", 0, -1],
	["s", 0, 1],
	["w", -1, 0],
	["e", 1, 0],
] as const;

/** The raised top faces + cliff walls of the cells in a (inclusive) range. Pure. */
export function computeRelief(
	sample: TerrainSampler,
	range: { c0: number; c1: number; r0: number; r1: number },
): Relief {
	const tops = new Map<number, ReliefTop[]>();
	const walls: ReliefWall[] = [];
	for (let r = range.r0; r <= range.r1; r++) {
		for (let c = range.c0; c <= range.c1; c++) {
			const terrain = sample(c, r);
			const level = terrainLevel(terrain);
			if (!terrain || level <= 0) continue;
			const k = cellKey(c, r);
			let list = tops.get(level);
			if (!list) {
				list = [];
				tops.set(level, list);
			}
			list.push({ key: k, col: c, row: r, terrain });
			for (const [side, dc, dr] of NEIGHBOURS) {
				const below = terrainLevel(sample(c + dc, r + dr));
				if (below < level) {
					walls.push({
						key: `${k}:${side}`,
						col: c,
						row: r,
						side,
						top: level,
						bottom: below,
						terrain,
					});
				}
			}
		}
	}
	return { tops, walls };
}

/**
 * Screen-space placement of a wall (the layer is fixed: world → screen through the
 * viewport). The wall starts as a flat strip on the board along the cell edge and is
 * folded up into the vertical plane: lifted to its top level, then rotated 90° about
 * the edge so it hangs down to the neighbour's level.
 */
export function wallStyle(
	w: ReliefWall,
	tile: number,
	vp: Pick<Viewport, "x" | "y" | "zoom">,
): CSSProperties {
	const t = tile * vp.zoom;
	const h = (w.top - w.bottom) * LEVEL_HEIGHT * vp.zoom;
	const lift = w.top * LEVEL_HEIGHT * vp.zoom;
	const x = w.col * t + vp.x;
	const y = w.row * t + vp.y;
	const base: CSSProperties = { position: "absolute", transformOrigin: "0 0" };
	switch (w.side) {
		case "n":
			return {
				...base,
				left: x,
				top: y,
				width: t,
				height: h,
				transform: `translateZ(${lift}px) rotateX(-90deg)`,
			};
		case "s":
			return {
				...base,
				left: x,
				top: y + t,
				width: t,
				height: h,
				transform: `translateZ(${lift}px) rotateX(-90deg)`,
			};
		case "w":
			return {
				...base,
				left: x,
				top: y,
				width: h,
				height: t,
				transform: `translateZ(${lift}px) rotateY(90deg)`,
			};
		case "e":
			return {
				...base,
				left: x + t,
				top: y,
				width: h,
				height: t,
				transform: `translateZ(${lift}px) rotateY(90deg)`,
			};
	}
}

export function MapReliefLayer({
	store,
	renderMode,
	tile,
}: {
	store: BoardStore;
	renderMode?: RenderMode;
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
		window.addEventListener("resize", rerender);
		return () => {
			u1();
			u2();
			window.removeEventListener("resize", rerender);
			cancelAnimationFrame(rafRef.current);
		};
	}, [store]);

	const vp = store.getViewport();
	// Zoomed out the terrain itself drops to flat coarse blocks; so does the relief.
	if (tileDetail(tile * vp.zoom, renderMode) !== "full") return null;
	const visible = visibleCellRange(visibleWorldRect(store), tile);
	if (!visible) return null;
	// Stay a couple of cells inside the flat terrain's extent: raised faces on its very
	// edge would stick up past where the ground ends and float against the sky.
	const range = {
		c0: visible.c0 + EDGE_INSET,
		c1: visible.c1 - EDGE_INSET,
		r0: visible.r0 + EDGE_INSET,
		r1: visible.r1 - EDGE_INSET,
	};
	const relief = computeRelief(boardTerrainSampler(store), range);
	if (relief.walls.length === 0 && relief.tops.size === 0) return null;

	const cfg = renderConfigStore.get();
	const levels = [...relief.tops.keys()].sort((a, b) => a - b);

	return (
		<div
			data-uskmap-relief=""
			style={
				{
					// Sized in px, not `inset: 0`: as a depth layer its wrappers get preserve-3d,
					// which makes the (0-height) inner wrapper the containing block, so a
					// percentage box would collapse and the top faces would not paint.
					position: "absolute",
					left: 0,
					top: 0,
					width: window.innerWidth,
					height: window.innerHeight,
					pointerEvents: "none",
					display: "none",
					transformStyle: "preserve-3d",
					...terrainCssVars(cfg.colorMode, cfg.strokeScale),
				} as CSSProperties
			}
		>
			<style>{STAGE_CSS}</style>
			{relief.walls.map((w) => (
				<div
					key={w.key}
					style={{
						...wallStyle(w, tile, vp),
						background: terrainDarkVar(w.terrain),
						// East/west faces a touch darker so the two wall directions read apart.
						boxShadow:
							w.side === "w" || w.side === "e" ? "inset 0 0 0 9999px rgba(0,0,0,.12)" : undefined,
					}}
				/>
			))}
			{levels.map((level) => {
				const cells = relief.tops.get(level) ?? [];
				// Each face is only as big as its cells' bounding box: a lifted plane is its
				// own compositing layer, and a full-viewport one near the camera is costly.
				let c0 = Infinity;
				let r0 = Infinity;
				let c1 = -Infinity;
				let r1 = -Infinity;
				for (const cell of cells) {
					c0 = Math.min(c0, cell.col);
					r0 = Math.min(r0, cell.row);
					c1 = Math.max(c1, cell.col + 1);
					r1 = Math.max(r1, cell.row + 1);
				}
				const left = c0 * tile * vp.zoom + vp.x;
				const top = r0 * tile * vp.zoom + vp.y;
				const width = (c1 - c0) * tile * vp.zoom;
				const height = (r1 - r0) * tile * vp.zoom;
				return (
					<svg
						key={`top-${level}`}
						width={width}
						height={height}
						style={{
							position: "absolute",
							left,
							top,
							overflow: "visible",
							transform: `translateZ(${level * LEVEL_HEIGHT * vp.zoom}px)`,
						}}
					>
						{/* Patterns come from MapTerrainLayer's <defs> (document-wide ids). */}
						<g transform={`translate(${vp.x - left} ${vp.y - top}) scale(${vp.zoom})`}>
							{cells.map((cell) => (
								<rect
									key={cell.key}
									x={cell.col * tile}
									y={cell.row * tile}
									width={tile}
									height={tile}
									fill={`url(#${terrainPatternId(cell.terrain)})`}
									stroke={CELL_LINE}
									strokeWidth={1}
								/>
							))}
						</g>
					</svg>
				);
			})}
		</div>
	);
}
