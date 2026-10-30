// MapReliefLayer — the terrain's height in 3D. Cells above sea level get their
// terrain repainted as a top face lifted to their level (one SVG per level), and a
// cliff wall stands on every edge where the neighbour is lower. Only a 3D view gives
// those depths meaning, so the layer renders only while a 3D stage is on (the flat
// board already shows the same terrain in MapTerrainLayer) and is meant to be one of
// Mode 7's depth layers.
import type { BoardStore, RenderMode } from "@edv4h/usketch-shared";
import { type CSSProperties, memo, useEffect, useMemo, useRef, useState } from "react";
import { cellKey } from "./autotile.js";
import type { TerrainSampler } from "./base-terrain.js";
import { inChunkRange, parseChunkKey } from "./chunk-plan.js";
import { CELL_LINE, isKnownTerrain } from "./ground-markup.js";
import { tileDetail } from "./lod.js";
import { CHUNK_CELLS, groundChunkRanges, visibleCellRange, visibleWorldRect } from "./map-layer.js";
import { terrainCssVars } from "./palette.js";
import type { ReactiveStore } from "./reactive-store.js";
import { renderConfigStore } from "./render-config.js";
import { type TerrainKey, terrainDarkVar, terrainPatternId } from "./terrain.js";
import { boardTerrainSampler, LEVEL_HEIGHT, terrainLevel } from "./terrain-height.js";
import { useChunkPlan } from "./use-chunk-plan.js";

export const RELIEF_LAYER_ID = "usketch-map:relief";

/** Cells left flat along the edge of the drawn terrain (see the render). */
const EDGE_INSET = 2;
/** Step (cells) the relief's on-screen extent moves in. */
const REGION_STEP = 4;
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
	overscan,
}: {
	store: BoardStore;
	renderMode?: RenderMode;
	tile: number;
	/** Whether a 3D stage (Mode 7) is on; the relief is only built and drawn then. */
	stage: ReactiveStore<{ active: boolean }>;
	/** The ground's 3D overscan (as given to MapTerrainLayer), to stay inside its extent. */
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
		const u3 = stage.subscribe(rerender);
		const u4 = overscan?.subscribe(rerender);
		window.addEventListener("resize", rerender);
		return () => {
			u1();
			u2();
			u3();
			u4?.();
			window.removeEventListener("resize", rerender);
			cancelAnimationFrame(rafRef.current);
		};
	}, [store, stage, overscan]);

	const vp = store.getViewport();
	const zoom = vp.zoom;
	const cfg = renderConfigStore.get();
	// Zoomed out the terrain itself drops to flat coarse blocks; so does the relief.
	const on = stage.get().active && tileDetail(tile * zoom, renderMode) === "full";
	// Drawn chunk by chunk like the ground, over the on-screen rect (no overscan); chunks
	// about to come into view are built a chunk per frame and stay hidden until they do.
	const visible = on ? visibleWorldRect(store) : null;
	const ranges = on ? groundChunkRanges(visible, tile) : null;
	const chunks = useChunkPlan(ranges, 1);
	const sampler = on ? boardTerrainSampler(store) : null;
	const ground = on
		? groundChunkRanges(visibleWorldRect(store, overscan?.get().px ?? 0), tile)?.need
		: null;
	const view = visibleCellRange(visible, tile);
	if (!sampler || !ranges || !ground || !view || chunks.length === 0) return null;
	// The cells the relief covers: the on-screen ones in steps of a few cells, kept a couple
	// of cells inside the drawn ground — raised faces on its very edge would stick up past
	// where the ground ends and float against the sky. Only the chunks on this edge are
	// clipped, so only they are rebuilt as it moves.
	// First / last covered cell along an axis, from the ground's first / last chunk and
	// the first / last on-screen cell.
	const lo = (chunk: number, cell: number) =>
		Math.max(chunk * CHUNK_CELLS, Math.floor(cell / REGION_STEP) * REGION_STEP) + EDGE_INSET;
	const hi = (chunk: number, cell: number) =>
		Math.min((chunk + 1) * CHUNK_CELLS, Math.ceil((cell + 1) / REGION_STEP) * REGION_STEP) -
		1 -
		EDGE_INSET;
	const inner = {
		c0: lo(ground.cx0, view.c0),
		c1: hi(ground.cx1, view.c1),
		r0: lo(ground.cy0, view.r0),
		r1: hi(ground.cy1, view.r1),
	};

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
				{chunks.map((key) => {
					const [cx, cy] = parseChunkKey(key);
					// The chunk's cells, clipped to the ground's inset extent (only the
					// chunks on its edge are clipped, so only they change as it moves).
					const c0 = Math.max(cx * CHUNK_CELLS, inner.c0);
					const c1 = Math.min((cx + 1) * CHUNK_CELLS - 1, inner.c1);
					const r0 = Math.max(cy * CHUNK_CELLS, inner.r0);
					const r1 = Math.min((cy + 1) * CHUNK_CELLS - 1, inner.r1);
					if (c0 > c1 || r0 > r1) return null;
					return (
						<ReliefChunk
							key={key}
							shown={inChunkRange(ranges.need, cx, cy)}
							sample={sampler}
							c0={c0}
							c1={c1}
							r0={r0}
							r1={r1}
							tile={tile}
							zoom={zoom}
						/>
					);
				})}
			</div>
		</div>
	);
}

/** A style object as CSS text (numbers are px). */
function cssText(style: CSSProperties): string {
	let out = "";
	for (const [key, value] of Object.entries(style)) {
		if (value == null) continue;
		const prop = key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
		out += `${prop}:${typeof value === "number" ? `${Number.isFinite(value) ? value : 0}px` : value};`;
	}
	return out;
}

/**
 * One chunk's walls + lifted top faces (an inclusive cell range) as markup, world × zoom.
 * Set as innerHTML, like the ground, so bringing a chunk into view doesn't build its
 * hundreds of elements through React. Only known terrain keys reach the markup.
 */
export function reliefChunkMarkup(
	sample: TerrainSampler,
	range: { c0: number; c1: number; r0: number; r1: number },
	tile: number,
	zoom: number,
): string {
	const relief = computeRelief(sample, range);
	let out = "";
	for (const w of relief.walls) {
		if (!isKnownTerrain(w.terrain)) continue;
		out += `<div style="${cssText({
			...wallStyle(w, tile, zoom),
			background: terrainDarkVar(w.terrain),
			// East/west faces a touch darker so the two wall directions read apart.
			boxShadow:
				w.side === "w" || w.side === "e" ? "inset 0 0 0 9999px rgba(0,0,0,.12)" : undefined,
		})}"></div>`;
	}
	const t = tile * zoom;
	for (const level of [...relief.tops.keys()].sort((a, b) => a - b)) {
		const faces = (relief.tops.get(level) ?? []).filter((cell) => isKnownTerrain(cell.terrain));
		if (faces.length === 0) continue;
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
		const style = cssText({
			position: "absolute",
			left: c0 * t,
			top: r0 * t,
			overflow: "visible",
			transform: `translateZ(${level * LEVEL_HEIGHT * zoom}px)`,
		});
		// Patterns come from MapTerrainLayer's <defs> (document-wide ids).
		let rects = "";
		for (const cell of faces) {
			rects += `<rect x="${cell.col * tile}" y="${cell.row * tile}" width="${tile}" height="${tile}" fill="url(#${terrainPatternId(cell.terrain)})" stroke="${CELL_LINE}" stroke-width="1"/>`;
		}
		out += `<svg width="${(c1 - c0) * t}" height="${(r1 - r0) * t}" style="${style}"><g transform="scale(${zoom}) translate(${-c0 * tile} ${-r0 * tile})">${rects}</g></svg>`;
	}
	return out;
}

/** One chunk of the relief; its markup is rebuilt only when its cells, the terrain or the zoom change. */
const ReliefChunk = memo(function ReliefChunk({
	shown,
	sample,
	c0,
	c1,
	r0,
	r1,
	tile,
	zoom,
}: {
	/** False for a chunk built ahead: hidden (not painted) until it comes into view. */
	shown: boolean;
	sample: TerrainSampler;
	c0: number;
	c1: number;
	r0: number;
	r1: number;
	tile: number;
	zoom: number;
}) {
	const html = useMemo(
		() => reliefChunkMarkup(sample, { c0, c1, r0, r1 }, tile, zoom),
		[sample, c0, c1, r0, r1, tile, zoom],
	);
	if (!html) return null;
	return (
		<div
			style={{
				position: "absolute",
				left: 0,
				top: 0,
				transformStyle: "preserve-3d",
				visibility: shown ? undefined : "hidden",
			}}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: markup from reliefChunkMarkup (known terrain keys + numbers only)
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
});
