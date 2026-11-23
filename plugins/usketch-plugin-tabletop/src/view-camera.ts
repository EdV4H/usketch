import {
	type BoardStore,
	type BoundingBox,
	type ProjectionCamera,
	projectStagePoint,
	type ShapeData,
	safeRotation,
	screenToWorld,
	unprojectStagePoint,
	type Viewport,
	type ViewportConstraint,
	worldToScreen,
	wrapDeg,
} from "@edv4h/usketch-shared";
import type { ViewCamera } from "./view.js";

// Bringing a camera to a view and holding it there. Screen = viewport.{x,y} + world * zoom.
// The fit / stay-inside math is the same as gathering's (`usketch-session-gather`).
//
// A turned view (a seat across the table) turns the camera the other way, so the view
// shows upright on that player's screen. With the camera turned by `r`, screen =
// t + zoom · R(r)·world, so in "turned" coordinates L = R(r)·world the camera is an
// unturned one: the same fit / clamp math runs on the view's box in L.
//
// A tilted camera (the board shown leaning back in 3D, e.g. by Mode 7) draws the flat
// stage through a perspective tilt about the horizon line, so the view's box shows as a
// trapezoid: narrower and smaller far away (top), wider near (bottom). With a `tilt`, the
// fit / clamp math keeps that trapezoid on screen instead of the flat box (see
// `fitViewToScreen`). The tilt is the host's; this only frames the view for it.

/** A view's box and how far it is turned (degrees, clockwise, like a shape's `rotation`). */
export interface ViewRect extends BoundingBox {
	rotation?: number;
}

/** The {@link ViewRect} of a view shape (its box and its turn). */
export function viewRectOf(
	shape: Pick<ShapeData, "x" | "y" | "width" | "height" | "rotation">,
): ViewRect {
	const rect: ViewRect = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
	const rotation = safeRotation(shape.rotation);
	if (rotation !== 0) rect.rotation = rotation;
	return rect;
}

/** The camera turn that shows `rect` upright (0 for an unturned view). */
export function viewCameraRotation(rect: ViewRect): number {
	return wrapDeg(-safeRotation(rect.rotation));
}

/** `rect`'s box in the coordinates of a camera turned by `rotation` (see the top). */
function turnedBox(rect: ViewRect, rotation: number): BoundingBox {
	if (rotation === 0) return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
	const c = worldToScreen(rect.x + rect.width / 2, rect.y + rect.height / 2, {
		x: 0,
		y: 0,
		zoom: 1,
		rotation,
	});
	return {
		x: c.x - rect.width / 2,
		y: c.y - rect.height / 2,
		width: rect.width,
		height: rect.height,
	};
}

/** `vp` turned to `rotation` (the key left out when 0, like an unturned viewport). */
function withTurn({ rotation: _r, ...vp }: Viewport, rotation: number): Viewport {
	return rotation === 0 ? vp : { ...vp, rotation };
}

/**
 * A 3D view the camera looks through: the flat stage tilted back by `pitch` about the
 * horizon line (`perspective(fov) rotateX(pitch)`, like `tiltCss` in
 * `@edv4h/usketch-shared`). The host draws it (e.g. Mode 7's camera); the view camera
 * only frames the view for it. A pitch of 0 (or less) is the flat camera. There is no
 * yaw: a view's turn is the camera's turn (the viewport's rotation), so a host keeps
 * its 3D view's own yaw at 0 while a view is applied.
 */
export interface ViewTilt {
	/** How far the ground leans back, degrees (0 = straight down). */
	pitch: number;
	/** CSS `perspective()` distance in px. */
	fov: number;
	/** The pivot line as a fraction of the screen height. */
	horizon: number;
	/** Px the 3D camera is raised (everything is drawn this much lower). Default 0. */
	heightPx?: number;
}

const isTilted = (tilt: ViewTilt | null | undefined): tilt is ViewTilt =>
	!!tilt &&
	Number.isFinite(tilt.pitch) &&
	tilt.pitch > 1e-3 &&
	Number.isFinite(tilt.fov) &&
	tilt.fov > 0 &&
	Number.isFinite(tilt.horizon);

const projectionOf = (tilt: ViewTilt): ProjectionCamera => ({
	pitch: tilt.pitch,
	yaw: 0,
	fov: tilt.fov,
	horizon: tilt.horizon,
	heightPx: Number.isFinite(tilt.heightPx) ? tilt.heightPx : 0,
});

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

/**
 * What a screen of `size` shows as a view: its own width and height in world units
 * around the world point at its centre, turned like the camera (so applying it
 * brings back the same picture, also on a turned camera).
 */
export function screenViewRect(vp: Viewport, size: ViewportSize): ViewRect {
	const c = screenToWorld(size.width / 2, size.height / 2, vp);
	const width = size.width / vp.zoom;
	const height = size.height / vp.zoom;
	const rect: ViewRect = { x: c.x - width / 2 + 0, y: c.y - height / 2 + 0, width, height };
	const rotation = wrapDeg(-safeRotation(vp.rotation));
	if (rotation !== 0) rect.rotation = rotation;
	return rect;
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

/**
 * The viewport that shows all of `rect`, centred, whatever the screen's shape. A
 * turned view turns the camera too, so it shows upright. With a `tilt` the view is
 * framed as the tilted camera draws it: its far edge on the top padding, as large as
 * fits with its near (wider) edge inside the sides and the bottom.
 */
export function fitViewToScreen(
	rect: ViewRect,
	size: ViewportSize,
	padding: number = VIEW_FIT_PADDING,
	tilt?: ViewTilt | null,
): Viewport {
	const rotation = viewCameraRotation(rect);
	const box = turnedBox(rect, rotation);
	if (isTilted(tilt)) {
		const fit = tiltedFit(box, size, padding, tilt);
		if (fit) return withTurn(fit, rotation);
	}
	const zoom = viewFitZoom(box, size, padding);
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	return withTurn(
		{ x: size.width / 2 - cx * zoom + 0, y: size.height / 2 - cy * zoom + 0, zoom },
		rotation,
	);
}

/**
 * The tilted fit of an unturned `box` (see {@link fitViewToScreen}), or `null` when the
 * screen shows no ground to put it on. The box is centred across the screen (the tilt
 * pivots about the middle, so it stays symmetric); its far edge is drawn on the top
 * padding (or just below the vanishing line, when that is lower), and the zoom is the
 * largest at which its near edge is still inside the sides and above the bottom padding.
 */
function tiltedFit(
	box: BoundingBox,
	size: ViewportSize,
	padding: number,
	tilt: ViewTilt,
): Fit | null {
	const cam = projectionOf(tilt);
	const cx = size.width / 2;
	const bottom = size.height - padding;
	const halfWidth = Math.max(1, size.width / 2 - padding);
	// Where the far edge is drawn: the top padding, or a little below the vanishing line.
	const rad = (tilt.pitch * Math.PI) / 180;
	const vanishing = size.height * tilt.horizon - tilt.fov / Math.tan(rad);
	const top = Math.max(padding, vanishing + Math.max(1, size.height * 0.01));
	if (top >= bottom) return null;
	const far = unprojectStagePoint(cx, top, cam, size);
	if (!far) return null;
	const width = Math.max(1, box.width);
	const height = Math.max(1, box.height);
	// Every corner on screen (the near ones are the widest and lowest on a usual tilt,
	// but a raised camera or a low horizon can make it otherwise).
	const fits = (zoom: number): boolean => {
		const half = (width * zoom) / 2;
		for (const y of [far.y, far.y + height * zoom]) {
			const p = projectStagePoint(cx + half, y, cam, size);
			if (!p || p.y > bottom + 1e-6 || p.y < top - 1e-6 || p.x - cx > halfWidth) return false;
		}
		return true;
	};
	let lo = 0;
	let hi = viewFitZoom(box, size, padding);
	// The far part shrinks, so the tilted fit can be closer than the flat one: grow first.
	for (let i = 0; i < 40 && fits(hi); i++) {
		lo = hi;
		hi *= 2;
	}
	for (let i = 0; i < 50; i++) {
		const mid = (lo + hi) / 2;
		if (fits(mid)) lo = mid;
		else hi = mid;
	}
	if (lo <= 0) return null;
	const zoom = lo;
	return {
		x: cx - (box.x + width / 2) * zoom + 0,
		y: far.y - box.y * zoom + 0,
		zoom,
	};
}

type Fit = { x: number; y: number; zoom: number };

/**
 * {@link tiltedFit} remembering its last answer: a constraint runs on every commit
 * (every animation frame), and the fit only changes with the view, screen or tilt.
 */
function memoTiltedFit(): (
	box: BoundingBox,
	size: ViewportSize,
	padding: number,
	tilt: ViewTilt,
) => Fit | null {
	let lastKey = "";
	let last: Fit | null = null;
	return (box, size, padding, tilt) => {
		const key = [
			box.x,
			box.y,
			box.width,
			box.height,
			size.width,
			size.height,
			padding,
			tilt.pitch,
			tilt.fov,
			tilt.horizon,
			tilt.heightPx ?? 0,
		].join(",");
		if (key !== lastKey) {
			lastKey = key;
			last = tiltedFit(box, size, padding, tilt);
		}
		return last;
	};
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
	getRect: () => ViewRect | null;
	getSize: () => ViewportSize | null;
	padding?: number;
	/** The 3D tilt the camera is drawn with, read live (null / absent = flat). */
	getTilt?: () => ViewTilt | null;
}

const readRect = (opts: RectConstraintOptions) => {
	const rect = opts.getRect();
	const size = opts.getSize();
	if (!rect || !size || size.width <= 0 || size.height <= 0) return null;
	const tilt = opts.getTilt?.() ?? null;
	return { rect, size, tilt: isTilted(tilt) ? tilt : null };
};

/**
 * `zoom`: keep the camera inside `getRect()` — no zooming out past the fit (zooming
 * in is free), no panning outside; an axis where the view is smaller than the screen
 * stays centred. The camera can't be turned (turning it would show what is outside
 * the view): it keeps the view's own turn. Read live on every commit, so a resized
 * screen is followed. With a tilt (`getTilt`), the fit is the tilted one and the
 * camera may move off it only as far as it has zoomed in: at the fit it stays put,
 * zoomed in 2× it can reach half-way to the view's edges (the trapezoid a tilt draws
 * can't be clamped edge by edge like the flat box).
 */
export function stayInViewConstraint(opts: RectConstraintOptions): ViewportConstraint {
	const padding = opts.padding ?? VIEW_FIT_PADDING;
	const fitTilted = memoTiltedFit();
	return (proposed) => {
		const read = readRect(opts);
		if (!read) return proposed;
		const { size, tilt } = read;
		const rotation = viewCameraRotation(read.rect);
		const rect = turnedBox(read.rect, rotation);
		const vp = withTurn(proposed, rotation);
		const fit = tilt ? fitTilted(rect, size, padding, tilt) : null;
		const minZoom = fit ? fit.zoom : viewFitZoom(rect, size, padding);
		let { x, y, zoom } = vp;
		if (!Number.isFinite(zoom) || zoom <= 0) {
			({ x, y, zoom } = fit ?? fitViewToScreen(rect, size, padding));
		} else if (zoom < minZoom) {
			// Zoom back about the screen centre so the pivot doesn't jump.
			const scale = minZoom / zoom;
			x = size.width / 2 - (size.width / 2 - x) * scale;
			y = size.height / 2 - (size.height / 2 - y) * scale;
			zoom = minZoom;
		}
		if (fit) return { ...vp, ...clampTilted(rect, fit, { x, y, zoom }), zoom };
		return {
			...vp,
			x: clampAxis(x, rect.x, rect.width, zoom, size.width, padding),
			y: clampAxis(y, rect.y, rect.height, zoom, size.height, padding),
			zoom,
		};
	};
}

/**
 * Keep a tilted camera near its fit (see {@link stayInViewConstraint}): the point of the
 * view drawn where the fit draws the view's centre may move from that centre by the
 * share of the view the zoom has gained (`1 − fit.zoom / zoom` of the half size).
 */
function clampTilted(box: BoundingBox, fit: Fit, vp: Fit): { x: number; y: number } {
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	// The stage point (px) where the fit draws the view's centre.
	const fx = fit.x + cx * fit.zoom;
	const fy = fit.y + cy * fit.zoom;
	const reach = Math.max(0, 1 - fit.zoom / vp.zoom);
	const clamp = (v: number, c: number, half: number) => Math.min(c + half, Math.max(c - half, v));
	const px = clamp((fx - vp.x) / vp.zoom, cx, (box.width / 2) * reach);
	const py = clamp((fy - vp.y) / vp.zoom, cy, (box.height / 2) * reach);
	return { x: fx - px * vp.zoom + 0, y: fy - py * vp.zoom + 0 };
}

/**
 * `fixed`: the camera always shows `getRect()` fitted, whatever is asked (upright: a
 * turned view turns the camera; tilted: framed for the tilt).
 */
export function pinToViewConstraint(opts: RectConstraintOptions): ViewportConstraint {
	const padding = opts.padding ?? VIEW_FIT_PADDING;
	const fitTilted = memoTiltedFit();
	return (vp) => {
		const read = readRect(opts);
		if (!read) return vp;
		const { rect, size, tilt } = read;
		if (tilt) {
			const rotation = viewCameraRotation(rect);
			const fit = fitTilted(turnedBox(rect, rotation), size, padding, tilt);
			if (fit) return withTurn(fit, rotation);
		}
		return fitViewToScreen(rect, size, padding);
	};
}

/** Whether the camera shows `rect` as {@link fitViewToScreen} would (within half a pixel). */
export function isAtView(
	vp: Viewport,
	rect: ViewRect,
	size: ViewportSize,
	padding: number = VIEW_FIT_PADDING,
	tilt?: ViewTilt | null,
): boolean {
	const fit = fitViewToScreen(rect, size, padding, tilt);
	return (
		Math.abs(vp.x - fit.x) < 0.5 &&
		Math.abs(vp.y - fit.y) < 0.5 &&
		Math.abs(vp.zoom - fit.zoom) < 1e-4 &&
		Math.abs(wrapDeg(safeRotation(vp.rotation) - safeRotation(fit.rotation))) < 0.01
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
	/**
	 * The 3D tilt the host draws the board with while the view is applied (e.g. Mode 7's
	 * camera), read live; null / absent = flat. The view is framed for it.
	 */
	getTilt?: () => ViewTilt | null;
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
 * `getRect` is read live (the view's bounds and turn, e.g. {@link viewRectOf}; null =
 * leave the camera alone). A turned view turns the camera with it, also for `free`. Uses the
 * store's single viewport constraint. Applying another view on the same store
 * releases this one first.
 */
export function applyViewCamera(
	store: BoardStore,
	getRect: () => ViewRect | null,
	camera: ViewCamera,
	opts: ApplyViewCameraOptions,
): ViewCameraHandle {
	applied.get(store)?.release();
	const padding = opts.padding ?? VIEW_FIT_PADDING;
	const durationMs = opts.durationMs ?? 350;
	const constraintOpts = { getRect, getSize: opts.getSize, padding, getTilt: opts.getTilt };
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
		const target = fitViewToScreen(rect, size, padding, opts.getTilt?.());
		// Swing about the screen's centre, so a move that also turns the camera (to a
		// seat across the table) doesn't sweep the board off screen on the way.
		const pivot = { x: size.width / 2, y: size.height / 2 };
		if (animate) store.animateViewportTo(target, { durationMs, pivot });
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
