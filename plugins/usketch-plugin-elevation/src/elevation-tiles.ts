// Which tiles the flat layer draws: one tile is a chunk at some level of detail, and
// the level rises as the view zooms out (a tile then covers 2×2, 4×4… chunks sampled
// more sparsely), so the number of tiles on screen — and the work to draw them — stays
// about the same at any zoom on an infinite terrain.
import { type BoardStore, screenToOverlay, viewportRotation } from "@edv4h/usketch-shared";
import type { ElevationFieldConfig } from "./elevation-field.js";

/** A tile is at least this many screen px wide (else the level goes up). */
export const MIN_TILE_PX = 192;
/** Most tiles drawn at once (else the level goes up). */
export const MAX_TILES = 96;
/** Highest level of detail (a tile = 1024 × 1024 chunks). */
export const MAX_LEVEL = 10;

export interface WorldRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

export interface TilePlan {
	level: number;
	/** World units along a tile's side. */
	worldSize: number;
	/** Pixels of a tile's bitmap along a side. */
	px: number;
	tx0: number;
	tx1: number;
	ty0: number;
	ty1: number;
}

/** World units along a tile's side at a level. Pure. */
export function tileWorldSize(field: ElevationFieldConfig, level: number): number {
	return field.chunk * field.spacing * 2 ** level;
}

/** Bitmap resolution for a tile drawn `screenPx` wide: about one pixel per screen px, 64 … 512. Pure. */
export function tileBitmapPx(screenPx: number): number {
	let px = 64;
	while (px < 512 && px < screenPx * 0.9) px *= 2;
	return px;
}

/**
 * The tiles covering `rect` at `zoom`: the coarsest level that keeps tiles at least
 * {@link MIN_TILE_PX} wide, raised further while more than `maxTiles` would be needed.
 * `null` for an empty or non-finite rect. Pure.
 */
export function planTiles(
	field: ElevationFieldConfig,
	rect: WorldRect,
	zoom: number,
	maxTiles = MAX_TILES,
): TilePlan | null {
	if (!(zoom > 0) || ![rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite)) {
		return null;
	}
	if (rect.right <= rect.left || rect.bottom <= rect.top) return null;
	let level = 0;
	while (level < MAX_LEVEL && tileWorldSize(field, level) * zoom < MIN_TILE_PX) level++;
	for (;;) {
		const size = tileWorldSize(field, level);
		const tx0 = Math.floor(rect.left / size);
		const tx1 = Math.floor(rect.right / size);
		const ty0 = Math.floor(rect.top / size);
		const ty1 = Math.floor(rect.bottom / size);
		const count = (tx1 - tx0 + 1) * (ty1 - ty0 + 1);
		if (count <= maxTiles || level >= MAX_LEVEL) {
			return { level, worldSize: size, px: tileBitmapPx(size * zoom), tx0, tx1, ty0, ty1 };
		}
		level++;
	}
}

/**
 * The world rect the layer covers: the window's, grown by `overscanPx` screen px on
 * every side (ground a 3D view shows past the viewport). Under camera rotation the layer
 * turns with the world, so it is the square around the circle the turning screen sweeps
 * (same as the map's terrain).
 */
export function visibleWorldRect(store: BoardStore, overscanPx = 0): WorldRect | null {
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
		return { left: cx - r, top: cy - r, right: cx + r, bottom: cy + r };
	}
	return {
		left: (-pad - vp.x) / vp.zoom,
		top: (-pad - vp.y) / vp.zoom,
		right: (w + pad - vp.x) / vp.zoom,
		bottom: (h + pad - vp.y) / vp.zoom,
	};
}
