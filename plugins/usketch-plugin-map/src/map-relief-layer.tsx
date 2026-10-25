// MapReliefLayer — the terrain's height in 3D. Cells above sea level get their
// terrain repainted as a top face lifted to their level (one SVG per level), and a
// cliff wall stands on every edge where the neighbour is lower. Only a 3D view gives
// those depths meaning, so the layer renders only while a 3D stage is on (the flat
// board already shows the same terrain in MapTerrainLayer) and is meant to be one of
// Mode 7's depth layers.
import type { BoardStore, RenderMode } from "@edv4h/usketch-shared";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { cellKey } from "./autotile.js";
import type { TerrainSampler } from "./base-terrain.js";
import { tileDetail } from "./lod.js";
import { visibleCellRange, visibleRegion, visibleWorldRect } from "./map-layer.js";
import { terrainCssVars } from "./palette.js";
import type { ReactiveStore } from "./reactive-store.js";
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
	/** Cells the wall runs along (east from `col` for n/s, south from `row` for w/e):
	 *  neighbouring edges with the same side, levels and terrain become one wall. */
	length: number;
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

/**
 * The raised top faces + cliff walls of the cells in a (inclusive) range, with runs of
 * matching edges merged into one wall each (fewer 3D planes to composite). Pure.
 */
export function computeRelief(
	sample: TerrainSampler,
	range: { c0: number; c1: number; r0: number; r1: number },
): Relief {
	const tops = new Map<number, ReliefTop[]>();
	const walls: ReliefWall[] = [];
	// The wall currently open on each edge line (row for n/s, column for w/e).
	const open = new Map<string, ReliefWall>();
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
					// Extend the wall the previous cell on this edge line left, if it matches:
					// n/s walls run east along a row, w/e walls run south down a column.
					const along = side === "n" || side === "s";
					const lineKey = along ? `${side}:r${r}` : `${side}:c${c}`;
					const last = open.get(lineKey);
					if (
						last &&
						(along ? last.col + last.length === c : last.row + last.length === r) &&
						last.top === level &&
						last.bottom === below &&
						last.terrain === terrain
					) {
						last.length++;
						continue;
					}
					const wall: ReliefWall = {
						key: `${k}:${side}`,
						col: c,
						row: r,
						side,
						length: 1,
						top: level,
						bottom: below,
						terrain,
					};
					walls.push(wall);
					open.set(lineKey, wall);
				}
			}
		}
	}
	return { tops, walls };
}

/**
 * Placement of a wall in the layer's world frame (world units × `zoom`; the frame is
 * translated by the viewport). The wall starts as a flat strip on the board along the
 * cell edge(s) and is folded up into the vertical plane: lifted to its top level, then
 * rotated 90° about the edge so it hangs down to the neighbour's level.
 */
export function wallStyle(w: ReliefWall, tile: number, zoom: number): CSSProperties {
	const t = tile * zoom;
	const len = w.length * t;
	const h = (w.top - w.bottom) * LEVEL_HEIGHT * zoom;
	const lift = w.top * LEVEL_HEIGHT * zoom;
	const x = w.col * t;
	const y = w.row * t;
	const base: CSSProperties = { position: "absolute", transformOrigin: "0 0" };
	switch (w.side) {
		case "n":
		case "s":
			return {
				...base,
				left: x,
				top: w.side === "s" ? y + t : y,
				width: len,
				height: h,
				transform: `translateZ(${lift}px) rotateX(-90deg)`,
			};
		case "w":
		case "e":
			return {
				...base,
				left: w.side === "e" ? x + t : x,
				top: y,
				width: h,
				height: len,
				transform: `translateZ(${lift}px) rotateY(90deg)`,
			};
	}
}

export function MapReliefLayer({
	store,
	renderMode,
	tile,
	stage,
}: {
	store: BoardStore;
	renderMode?: RenderMode;
	tile: number;
	/** Whether a 3D stage (Mode 7) is on; the relief is only built and drawn then. */
	stage: ReactiveStore<{ active: boolean }>;
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
		const u3 = stage.subscribe(rerender);
		window.addEventListener("resize", rerender);
		return () => {
			u1();
			u2();
			u3();
			window.removeEventListener("resize", rerender);
			cancelAnimationFrame(rafRef.current);
		};
	}, [store, stage]);

	const vp = store.getViewport();
	const zoom = vp.zoom;
	const cfg = renderConfigStore.get();
	// Zoomed out the terrain itself drops to flat coarse blocks; so does the relief.
	const on = stage.get().active && tileDetail(tile * zoom, renderMode) === "full";
	// The on-screen region in steps of a few cells (rebuilt only when it moves a step),
	// which the flat ground always covers.
	const area = on ? visibleRegion(visibleWorldRect(store), tile) : null;
	const sampler = on ? boardTerrainSampler(store) : null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the area's edges
	const content = useMemo(
		() => (sampler && area ? renderRelief(sampler, area, tile, zoom) : null),
		[sampler, tile, zoom, area?.left, area?.top, area?.width, area?.height],
	);
	if (!content) return null;

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
			{/* The world frame: only its translate changes while panning. */}
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					transform: `translate3d(${vp.x}px, ${vp.y}px, 0)`,
					transformStyle: "preserve-3d",
				}}
			>
				{content}
			</div>
		</div>
	);
}

/** The walls + lifted top faces over `area` (cells inset from its edge), world × zoom. */
function renderRelief(
	sample: TerrainSampler,
	area: DOMRectReadOnly,
	tile: number,
	zoom: number,
): React.ReactElement | null {
	const cells = visibleCellRange(area, tile);
	if (!cells) return null;
	// Stay a couple of cells inside the flat terrain's extent: raised faces on its very
	// edge would stick up past where the ground ends and float against the sky.
	const relief = computeRelief(sample, {
		c0: cells.c0 + EDGE_INSET,
		c1: cells.c1 - EDGE_INSET,
		r0: cells.r0 + EDGE_INSET,
		r1: cells.r1 - EDGE_INSET,
	});
	if (relief.walls.length === 0 && relief.tops.size === 0) return null;
	const levels = [...relief.tops.keys()].sort((a, b) => a - b);
	const t = tile * zoom;
	return (
		<>
			{relief.walls.map((w) => (
				<div
					key={w.key}
					style={{
						...wallStyle(w, tile, zoom),
						background: terrainDarkVar(w.terrain),
						// East/west faces a touch darker so the two wall directions read apart.
						boxShadow:
							w.side === "w" || w.side === "e" ? "inset 0 0 0 9999px rgba(0,0,0,.12)" : undefined,
					}}
				/>
			))}
			{levels.map((level) => {
				const faces = relief.tops.get(level) ?? [];
				// Each face is only as big as its cells' bounding box: a lifted plane is its
				// own compositing layer, and a full-viewport one near the camera is costly.
				let c0 = Infinity;
				let r0 = Infinity;
				let c1 = -Infinity;
				let r1 = -Infinity;
				for (const cell of faces) {
					c0 = Math.min(c0, cell.col);
					r0 = Math.min(r0, cell.row);
					c1 = Math.max(c1, cell.col + 1);
					r1 = Math.max(r1, cell.row + 1);
				}
				return (
					<svg
						key={`top-${level}`}
						width={(c1 - c0) * t}
						height={(r1 - r0) * t}
						style={{
							position: "absolute",
							left: c0 * t,
							top: r0 * t,
							overflow: "visible",
							transform: `translateZ(${level * LEVEL_HEIGHT * zoom}px)`,
						}}
					>
						{/* Patterns come from MapTerrainLayer's <defs> (document-wide ids). */}
						<g transform={`scale(${zoom}) translate(${-c0 * tile} ${-r0 * tile})`}>
							{faces.map((cell) => (
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
		</>
	);
}
