// Shared, DOM-aware viewport helpers. These consolidate the "getViewport →
// compute target → move" logic that plugins used to hand-roll (vim, whistle,
// command-palette, keyboard zoom). They animate by default via
// `store.animateViewportTo`, so every logic-driven jump/zoom is smooth.
import type { Point, Viewport } from "../types/geometry.js";
import type { BoardStore } from "../types/plugin.js";

/** Ease-in-out cubic — the default viewport-animation easing. */
export function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** Canvas pixel size (assumes a full-window canvas; falls back when no `window`). */
export function getScreenSize(): { width: number; height: number } {
	if (typeof window === "undefined") return { width: 1280, height: 720 };
	return { width: window.innerWidth, height: window.innerHeight };
}

/** World coordinate currently at the screen centre. */
export function screenCenterWorld(store: BoardStore): Point {
	const { width, height } = getScreenSize();
	const vp = store.getViewport();
	return { x: (width / 2 - vp.x) / vp.zoom, y: (height / 2 - vp.y) / vp.zoom };
}

/** Shared move options passed through to `animateViewportTo`. */
export interface ViewportMoveOptions {
	animate?: boolean;
	durationMs?: number;
}

/** Move so that world `point` sits at the screen centre (optionally re-zoom). */
export function centerOnWorld(
	store: BoardStore,
	point: Point,
	opts: ViewportMoveOptions & { zoom?: number } = {},
): void {
	const { width, height } = getScreenSize();
	const zoom = opts.zoom ?? store.getViewport().zoom;
	const target: Viewport = {
		x: width / 2 - point.x * zoom,
		y: height / 2 - point.y * zoom,
		zoom,
	};
	store.animateViewportTo(target, opts);
}

/** Zoom to an absolute level about `center` (screen px; default screen centre). */
export function zoomToLevel(
	store: BoardStore,
	zoom: number,
	opts: ViewportMoveOptions & { center?: Point } = {},
): void {
	const { width, height } = getScreenSize();
	const center = opts.center ?? { x: width / 2, y: height / 2 };
	const vp = store.getViewport();
	const clamped = Math.min(Math.max(zoom, 0.1), 10);
	const scale = clamped / vp.zoom;
	const target: Viewport = {
		x: center.x - (center.x - vp.x) * scale,
		y: center.y - (center.y - vp.y) * scale,
		zoom: clamped,
	};
	store.animateViewportTo(target, opts);
}

/** Zoom by a multiplicative `factor` about `center` (default screen centre). */
export function zoomBy(
	store: BoardStore,
	factor: number,
	opts: ViewportMoveOptions & { center?: Point } = {},
): void {
	zoomToLevel(store, store.getViewport().zoom * factor, opts);
}

/** Fit all shapes into view (no-op when the board is empty). */
export function fitContent(
	store: BoardStore,
	opts: ViewportMoveOptions & { padding?: number } = {},
): void {
	const shapes = store.getShapes();
	if (shapes.size === 0) return;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const s of shapes.values()) {
		minX = Math.min(minX, s.x);
		minY = Math.min(minY, s.y);
		maxX = Math.max(maxX, s.x + s.width);
		maxY = Math.max(maxY, s.y + s.height);
	}
	const width = maxX - minX;
	const height = maxY - minY;
	if (width <= 0 || height <= 0) return;
	store.fitToBounds({ x: minX, y: minY, width, height }, getScreenSize(), opts.padding ?? 40, {
		animate: opts.animate,
		durationMs: opts.durationMs,
	});
}
