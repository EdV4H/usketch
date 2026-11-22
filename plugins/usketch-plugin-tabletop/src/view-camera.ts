import {
	type BoardStore,
	type BoundingBox,
	screenToWorld,
	type Viewport,
	type ViewportConstraint,
} from "@edv4h/usketch-shared";
import type { ViewCamera } from "./view.js";

// Bringing a camera to a view and holding it there. Screen = viewport.{x,y} + world * zoom.
// The fit / stay-inside math is the same as gathering's (`usketch-session-gather`).

export interface ViewportSize {
	width: number;
	height: number;
}

/** Margin kept around a view, in screen px. */
export const VIEW_FIT_PADDING = 24;

/** The world area an (unrotated) viewport shows on a screen of `size`. */
export function visibleWorldRect(vp: Viewport, size: ViewportSize): BoundingBox {
	// `+ 0` turns -0 into 0.
	return {
		x: -vp.x / vp.zoom + 0,
		y: -vp.y / vp.zoom + 0,
		width: size.width / vp.zoom,
		height: size.height / vp.zoom,
	};
}

/**
 * The world bounds of what a screen of `size` shows: the box around its four
 * corners, so a turned camera is covered too.
 */
export function screenWorldBounds(vp: Viewport, size: ViewportSize): BoundingBox {
	const corners = [
		screenToWorld(0, 0, vp),
		screenToWorld(size.width, 0, vp),
		screenToWorld(0, size.height, vp),
		screenToWorld(size.width, size.height, vp),
	];
	const xs = corners.map((c) => c.x);
	const ys = corners.map((c) => c.y);
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Zoom at which `rect` plus `padding` fits the screen. */
export function viewFitZoom(
	rect: BoundingBox,
	size: ViewportSize,
	padding: number = VIEW_FIT_PADDING,
): number {
	const w = Math.max(1, size.width - padding * 2);
	const h = Math.max(1, size.height - padding * 2);
	return Math.min(w / Math.max(1, rect.width), h / Math.max(1, rect.height));
}

/** The viewport that shows all of `rect`, centred, whatever the screen's shape. */
export function fitViewToScreen(
	rect: BoundingBox,
	size: ViewportSize,
	padding: number = VIEW_FIT_PADDING,
): Viewport {
	const zoom = viewFitZoom(rect, size, padding);
	const cx = rect.x + rect.width / 2;
	const cy = rect.y + rect.height / 2;
	return { x: size.width / 2 - cx * zoom, y: size.height / 2 - cy * zoom, zoom };
}

/** One axis: centre what is smaller than the screen, else stop at its edges. */
function clampAxis(
	pos: number,
	start: number,
	length: number,
	zoom: number,
	screen: number,
	padding: number,
): number {
	if (length * zoom + padding * 2 <= screen) return screen / 2 - (start + length / 2) * zoom;
	const max = padding - start * zoom;
	const min = screen - padding - (start + length) * zoom;
	const r = Math.min(max, Math.max(min, pos));
	return r === 0 ? 0 : r;
}

interface RectConstraintOptions {
	getRect: () => BoundingBox | null;
	getSize: () => ViewportSize | null;
	padding?: number;
}

const readRect = (opts: RectConstraintOptions) => {
	const rect = opts.getRect();
	const size = opts.getSize();
	if (!rect || !size || size.width <= 0 || size.height <= 0) return null;
	return { rect, size };
};

/** Drop the camera's turn (a held view is always shown upright). */
const upright = ({ rotation: _r, ...vp }: Viewport): Viewport => vp;

/**
 * `zoom`: keep the camera inside `getRect()` — no zooming out past the fit (zooming
 * in is free), no panning outside; an axis where the view is smaller than the screen
 * stays centred. The camera can't be turned (turning it would show what is outside
 * the view). Read live on every commit, so a resized screen is followed.
 */
export function stayInViewConstraint(opts: RectConstraintOptions): ViewportConstraint {
	const padding = opts.padding ?? VIEW_FIT_PADDING;
	return (proposed) => {
		const read = readRect(opts);
		if (!read) return proposed;
		const { rect, size } = read;
		const vp = upright(proposed);
		const minZoom = viewFitZoom(rect, size, padding);
		let { x, y, zoom } = vp;
		if (!Number.isFinite(zoom) || zoom <= 0) {
			({ x, y, zoom } = fitViewToScreen(rect, size, padding));
		} else if (zoom < minZoom) {
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

/** `fixed`: the camera always shows `getRect()` fitted and upright, whatever is asked. */
export function pinToViewConstraint(opts: RectConstraintOptions): ViewportConstraint {
	const padding = opts.padding ?? VIEW_FIT_PADDING;
	return (vp) => {
		const read = readRect(opts);
		if (!read) return vp;
		return fitViewToScreen(read.rect, read.size, padding);
	};
}

/** Whether the camera shows `rect` as {@link fitViewToScreen} would (within half a pixel). */
export function isAtView(
	vp: Viewport,
	rect: BoundingBox,
	size: ViewportSize,
	padding: number = VIEW_FIT_PADDING,
): boolean {
	const fit = fitViewToScreen(rect, size, padding);
	return (
		Math.abs(vp.x - fit.x) < 0.5 &&
		Math.abs(vp.y - fit.y) < 0.5 &&
		Math.abs(vp.zoom - fit.zoom) < 1e-4
	);
}

export interface ApplyViewCameraOptions {
	/** The canvas size in CSS px, read live (null while unknown). */
	getSize: () => ViewportSize | null;
	padding?: number;
	/** Animate the move to the view. Default true. */
	animate?: boolean;
	/** Length of the move. Default 350 ms. */
	durationMs?: number;
}

export interface ViewCameraHandle {
	/** Take the hold off (only the constraint this installed). The camera stays where it is. */
	release(): void;
	/** Bring the camera back to the view (after zooming in, or anywhere with `free`). */
	returnToView(opts?: { animate?: boolean }): void;
}

/** The view camera applied on each store (applying another releases it). */
const applied = new WeakMap<BoardStore, ViewCameraHandle>();

/**
 * Bring the camera to a view and hold it there by `camera` (see {@link ViewCamera}).
 * `getRect` is read live (the view's bounds; null = leave the camera alone). Uses the
 * store's single viewport constraint. Applying another view on the same store
 * releases this one first.
 */
export function applyViewCamera(
	store: BoardStore,
	getRect: () => BoundingBox | null,
	camera: ViewCamera,
	opts: ApplyViewCameraOptions,
): ViewCameraHandle {
	applied.get(store)?.release();
	const padding = opts.padding ?? VIEW_FIT_PADDING;
	const durationMs = opts.durationMs ?? 350;
	const constraintOpts = { getRect, getSize: opts.getSize, padding };
	const constraint =
		camera === "fixed"
			? pinToViewConstraint(constraintOpts)
			: camera === "zoom"
				? stayInViewConstraint(constraintOpts)
				: null;
	let installTimer: ReturnType<typeof setTimeout> | null = null;
	let released = false;

	const install = (settle: boolean) => {
		installTimer = null;
		if (released || !constraint) return;
		// Installing cancels a move still running (a busy or background tab lags the
		// frames behind the timer), so finish it first instead of holding a midway camera.
		if (settle) moveTo(false);
		store.setViewportConstraint(constraint);
	};

	const moveTo = (animate: boolean) => {
		const rect = getRect();
		const size = opts.getSize();
		if (!rect || !size || size.width <= 0 || size.height <= 0) return false;
		const target = fitViewToScreen(rect, size, padding);
		if (animate) store.animateViewportTo(target, { durationMs });
		else store.setViewport(target);
		return true;
	};

	// The constraint goes on after the move: while it is on, every animation frame is
	// passed through it, so a move from outside the view would jump instead of glide.
	const animate = opts.animate ?? true;
	const moved = moveTo(animate);
	if (animate && moved && constraint)
		installTimer = setTimeout(() => install(true), durationMs + 50);
	else install(false);

	const handle: ViewCameraHandle = {
		release() {
			if (released) return;
			released = true;
			if (applied.get(store) === handle) applied.delete(store);
			if (installTimer !== null) clearTimeout(installTimer);
			installTimer = null;
			if (constraint && store.getViewportConstraint() === constraint) {
				store.setViewportConstraint(null);
			}
		},
		returnToView(o) {
			if (released) return;
			moveTo(o?.animate ?? true);
		},
	};
	applied.set(store, handle);
	return handle;
}
