import type { Viewport, ViewportConstraint } from "@edv4h/usketch-shared";
import type { GatherRect } from "./gather.js";

// Camera helpers for gathering. Screen = viewport.{x,y} + world * zoom.

/** Margin kept around the place, in screen px. */
export const GATHER_FIT_PADDING = 48;

export interface ViewportSize {
	width: number;
	height: number;
}

/** The world area a viewport shows (unrotated). */
export const visibleWorldRect = (vp: Viewport, size: ViewportSize): GatherRect => ({
	// `+ 0` turns -0 into 0.
	x: -vp.x / vp.zoom + 0,
	y: -vp.y / vp.zoom + 0,
	width: size.width / vp.zoom,
	height: size.height / vp.zoom,
});

/** Zoom at which `rect` plus `padding` fits the screen. */
export const fitZoom = (
	rect: GatherRect,
	size: ViewportSize,
	padding: number = GATHER_FIT_PADDING,
): number => {
	const w = Math.max(1, size.width - padding * 2);
	const h = Math.max(1, size.height - padding * 2);
	return Math.min(w / rect.width, h / rect.height);
};

/** Viewport that centres `rect` on screen. */
export const fitViewport = (
	rect: GatherRect,
	size: ViewportSize,
	padding: number = GATHER_FIT_PADDING,
): Viewport => {
	const zoom = fitZoom(rect, size, padding);
	const cx = rect.x + rect.width / 2;
	const cy = rect.y + rect.height / 2;
	return { x: size.width / 2 - cx * zoom, y: size.height / 2 - cy * zoom, zoom };
};

/**
 * One axis: centre content that is smaller than the screen, else stop at the
 * content's edge so nothing outside shows.
 */
const clampAxis = (
	pos: number,
	start: number,
	length: number,
	zoom: number,
	screen: number,
	padding: number,
): number => {
	if (length * zoom + padding * 2 <= screen) return screen / 2 - (start + length / 2) * zoom;
	const max = padding - start * zoom;
	const min = screen - padding - (start + length) * zoom;
	const r = Math.min(max, Math.max(min, pos));
	return r === 0 ? 0 : r;
};

/**
 * Keep the camera inside `rect`:
 * - no zooming out past the fit (zooming in is free)
 * - no panning outside; an axis where the place is smaller than the screen stays centred
 * - a rotated camera (Mode 7 and the like) is left alone
 *
 * `getRect` / `getSize` are read on every call, so a moving frame or a resized
 * window is followed.
 */
export function stayInRectConstraint(opts: {
	getRect: () => GatherRect | null;
	getSize: () => ViewportSize | null;
	padding?: number;
}): ViewportConstraint {
	const padding = opts.padding ?? GATHER_FIT_PADDING;
	return (vp) => {
		if (vp.rotation !== undefined && vp.rotation !== 0) return vp;
		const rect = opts.getRect();
		const size = opts.getSize();
		if (!rect || !size || size.width <= 0 || size.height <= 0) return vp;
		const minZoom = fitZoom(rect, size, padding);
		let { x, y, zoom } = vp;
		if (zoom < minZoom) {
			// Zoom back about the screen centre so the pivot doesn't jump.
			const scale = minZoom / zoom;
			x = size.width / 2 - (size.width / 2 - x) * scale;
			y = size.height / 2 - (size.height / 2 - y) * scale;
			zoom = minZoom;
		}
		return {
			...vp,
			x: clampAxis(x, rect.x, rect.width, zoom, size.width, padding),
			y: clampAxis(y, rect.y, rect.height, zoom, size.height, padding),
			zoom,
		};
	};
}
