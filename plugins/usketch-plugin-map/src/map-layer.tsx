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
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { chunkRange, inChunkRange, parseChunkKey } from "./chunk-plan.js";
import { genStateStore } from "./gen-state.js";
import { CELL_LINE, GRID_PATTERN_ID, groundMarkup, WOBBLE_FILTER_ID } from "./ground-markup.js";
import { tileDetail } from "./lod.js";
import { terrainCssVars } from "./palette.js";
import type { ReactiveStore } from "./reactive-store.js";
import { type MapRenderConfig, renderConfigStore } from "./render-config.js";
import { renderSvgNodes } from "./svg-nodes.js";
import { TERRAINS, terrainPatternId } from "./terrain.js";
import { boardTilemaps } from "./terrain-height.js";
import type { TileMapShapeData } from "./tilemap-shape.js";
import { type ChunkRanges, useChunkPlan } from "./use-chunk-plan.js";
import { WobbleFilter } from "./wobble-filter.js";

export { visibleCellRange, WOBBLE_FILTER_ID } from "./ground-markup.js";

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

/**
 * Shared SVG defs: 12 terrain patterns + a per-tile grid + the wobble filter. The filter
 * covers each filtered group's own box (one chunk), so it doesn't change while panning.
 * Memoized: the layer re-renders every frame the view moves, and rebuilding the
 * patterns' hundreds of elements each time was a large share of a frame's script.
 */
const MapDefs = memo(function MapDefs({ tile }: { tile: number }) {
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
			<WobbleFilter id={WOBBLE_FILTER_ID} />
		</defs>
	);
});

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
	const visible = visibleWorldRect(store, overscanPx);
	const pending = genStateStore.get().pendingRect;
	const zoom = vp.zoom;
	const cssVars = terrainCssVars(cfg.colorMode, cfg.strokeScale);
	// Zoomed in, the ground is drawn chunk by chunk (each memoized on its own), so walking
	// over a chunk edge only builds the chunks coming into view. Zoomed out, the coarse
	// tier's merged blocks are few and the chunks many, so it stays one drawing over the
	// visible rect snapped out to whole chunks.
	const chunked = tileDetail(defaultTile * zoom, renderMode) === "full";
	const ranges = chunked ? groundChunkRanges(visible, defaultTile) : null;
	const chunks = useChunkPlan(ranges, 1);
	const area = chunked ? null : chunkArea(visible, defaultTile);

	// The coarse ground depends on the drawn area, the board's tilemaps, the render config
	// and the zoom (LOD) — not on the pan, so it's rebuilt only when one of those changes
	// and React skips the (identical) subtree on every other frame.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the area's edges
	const coarse = useMemo(
		() => groundMarkup(tilemaps, cfg, defaultTile, zoom, renderMode, area),
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
				<MapDefs tile={defaultTile} />
			</svg>
			{visible && (
				// Only this wrapper moves while panning: a plain translate the compositor
				// can apply to the already-painted ground (the filtered SVG isn't redrawn).
				// It sits at the world origin; the one SVG inside draws in world units × zoom.
				// Chunks are groups in that SVG, not positioned boxes: a positioned box gets
				// its own paint layer, which Chrome repaints on every frame the wrapper moves.
				<div
					style={{
						position: "absolute",
						left: 0,
						top: 0,
						transform: `translate(${vp.x}px, ${vp.y}px)`,
						willChange: "transform",
					}}
				>
					{/* 1×1, not 0×0: an outer <svg> with a zero size isn't rendered at all. */}
					<svg width={1} height={1} style={{ display: "block", overflow: "visible" }}>
						<g transform={`scale(${zoom})`}>
							{chunks.map((key) => {
								const [cx, cy] = parseChunkKey(key);
								return (
									<GroundChunk
										key={key}
										cx={cx}
										cy={cy}
										shown={ranges != null && inChunkRange(ranges.need, cx, cy)}
										tilemaps={tilemaps}
										cfg={cfg}
										tile={defaultTile}
										zoom={zoom}
										renderMode={renderMode}
									/>
								);
							})}
							{coarse && (
								// biome-ignore lint/security/noDangerouslySetInnerHtml: markup from ground-markup (known terrain keys + numbers only)
								<g dangerouslySetInnerHTML={{ __html: coarse }} />
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
			)}
		</div>
	);
}

/**
 * One chunk of the ground at full detail, in world units. Its markup is rebuilt only when
 * the board's tilemaps, the render config, the tile, zoom or LOD change — never on a pan,
 * and never because another chunk came into view. A chunk built ahead stays hidden until
 * it is needed, so it isn't painted (or drawn past the usual edge in a 3D view) before.
 */
const GroundChunk = memo(function GroundChunk({
	cx,
	cy,
	shown,
	tilemaps,
	cfg,
	tile,
	zoom,
	renderMode,
}: {
	cx: number;
	cy: number;
	shown: boolean;
	tilemaps: readonly TileMapShapeData[];
	cfg: MapRenderConfig;
	tile: number;
	zoom: number;
	renderMode: RenderMode | undefined;
}) {
	const html = useMemo(() => {
		const size = CHUNK_CELLS * tile;
		const x0 = cx * size;
		const y0 = cy * size;
		// The wobble moves pixels across the chunk's edge, so the chunk also draws a cell of
		// its neighbours' ground for it to pull from. The filtered result there is opaque and
		// the same as the neighbour's own, so the overlap doesn't show.
		const margin = cfg.lineStyle === "wobble" ? tile : 0;
		const area = worldRect(x0 - margin, y0 - margin, size + 2 * margin, size + 2 * margin);
		return groundMarkup(tilemaps, cfg, tile, zoom, renderMode, area);
	}, [cx, cy, tilemaps, cfg, tile, zoom, renderMode]);
	return (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: markup from ground-markup (known terrain keys + numbers only)
		<g visibility={shown ? undefined : "hidden"} dangerouslySetInnerHTML={{ __html: html }} />
	);
});

/** Chunk side, in cells: the ground is drawn and memoized one chunk at a time. */
export const CHUNK_CELLS = 16;
/** How far (cells) past the drawn rect chunks are built ahead of coming into view. */
export const PREFETCH_CELLS = 8;

/** A plain rect (not `new DOMRectReadOnly`) so it also works outside a browser. */
function worldRect(left: number, top: number, width: number, height: number): DOMRectReadOnly {
	const right = left + width;
	const bottom = top + height;
	return { left, top, right, bottom, x: left, y: top, width, height, toJSON: () => ({}) };
}

/** `rect` snapped out to multiples of `step` (world units). */
function snapOut(rect: DOMRectReadOnly, step: number): DOMRectReadOnly {
	const left = Math.floor(rect.left / step) * step;
	const top = Math.floor(rect.top / step) * step;
	const right = Math.ceil(rect.right / step) * step;
	const bottom = Math.ceil(rect.bottom / step) * step;
	return worldRect(left, top, right - left, bottom - top);
}

/** `rect` grown to whole chunks of `tile`-sized cells (null passes through). */
export function chunkArea(
	rect: DOMRectReadOnly | null | undefined,
	tile: number,
): DOMRectReadOnly | null {
	return rect ? snapOut(rect, CHUNK_CELLS * tile) : null;
}

/**
 * The chunks the ground draws for a drawn rect (`visibleWorldRect`, with any 3D
 * overscan): the ones it overlaps (`need`, shown), and the ones within
 * {@link PREFETCH_CELLS} built ahead (hidden until needed) and kept until they drift
 * past that again.
 */
export function groundChunkRanges(
	visible: DOMRectReadOnly | null | undefined,
	tile: number,
): ChunkRanges | null {
	const size = CHUNK_CELLS * tile;
	const need = chunkRange(visible, size);
	const soon = chunkRange(visible, size, PREFETCH_CELLS * tile);
	return need && soon ? { need, soon, keep: chunkRange(visible, size, size) ?? soon } : null;
}
