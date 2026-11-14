// A follow camera: keeps something moving (a walking character, someone being followed)
// at a spot on screen, optionally turning the world so it faces up, and — while the board
// is shown in 3D — raises the view's camera with the ground it stands on, so walking up a
// mountain doesn't climb out of view.
//
// The math is pure. `createFollowView` drives the board with it for a caller that runs its
// own frame loop (the character steps its physics first, then the camera); `followView`
// runs a loop of its own for one that only has a target to follow.

import type { Point, Viewport } from "./types/geometry.js";
import type { BoardStore, ServiceRegistry } from "./types/plugin.js";
import { screenToWorld, viewportAnchoredAt, viewportRotation } from "./utils/geometry.js";
import { shortestAngleDelta, wrapDeg } from "./utils/rotation.js";
import { view3dService } from "./view-3d.js";

/**
 * - `fixed`:  follow; the world stays axis-aligned (as turned by the 3D view) and the
 *             target turns on screen.
 * - `rotate`: follow AND turn the world by `-heading`, so the target always faces
 *             screen-up (racing view).
 */
export type FollowViewMode = "fixed" | "rotate";

/** The eased camera: the world point pinned to the anchor, and the viewport's rotation. */
export interface FollowFocus {
	focus: Point;
	rotation: number;
}

/** The viewport rotation a mode wants for a heading (before the 3D view's own turn). */
export function followRotation(mode: FollowViewMode | "free", heading: number): number {
	return mode === "rotate" ? wrapDeg(-heading) : 0;
}

/**
 * Whether a viewport turn of `turned` degrees that the follow didn't make is the 3D view
 * turning by its heading (its turn changed by the same `viewTurned`). The follow then
 * turns with it instead of pausing as it does for a pan.
 */
export function turnedByView(turned: number, viewTurned: number): boolean {
	return Math.abs(turned) > 1e-9 && Math.abs(shortestAngleDelta(viewTurned, turned)) < 1e-6;
}

/**
 * Frame-rate-independent smoothing factor: `smoothing` 0 = rigid (always 1),
 * approaching 1 = heavier lag. It is the fraction LEFT after 1/60 s.
 */
export function smoothingAlpha(smoothing: number, dt: number): number {
	const s = Math.min(0.99, Math.max(0, smoothing));
	if (s === 0) return 1;
	return 1 - s ** (dt * 60);
}

/** Ease `current` toward `target` by `alpha` (rotation the short way round). */
export function easeFollowFocus(
	current: FollowFocus,
	target: FollowFocus,
	alpha: number,
): FollowFocus {
	if (alpha >= 1) return target;
	return {
		focus: {
			x: current.focus.x + (target.focus.x - current.focus.x) * alpha,
			y: current.focus.y + (target.focus.y - current.focus.y) * alpha,
		},
		rotation: wrapDeg(
			current.rotation + shortestAngleDelta(current.rotation, target.rotation) * alpha,
		),
	};
}

/**
 * The height (world units) the 3D view's camera should follow, platformer-style:
 *
 * - On the ground: the ground the target stands on (`z`).
 * - In the air (a jump, a fall, a hover): the height it left the ground from (`prev`)
 *   holds, so a jump still rises on screen and flying over a pit doesn't dip the view;
 *   but it never falls behind the body by more than `margin` (a hover climbing above
 *   an ordinary jump drags it up) nor stays above the feet (falling off a cliff takes
 *   it down).
 *
 * `prev` is the last value this returned, `null` when starting to follow (the body's
 * height is taken as is). Feed the result to the camera through its own smoothing.
 */
export function followCameraHeight(
	prev: number | null,
	pose: { z: number; airborne: boolean },
	margin: number,
): number {
	const z = Number.isFinite(pose.z) ? pose.z : 0;
	if (!pose.airborne || prev === null || !Number.isFinite(prev)) return z;
	const m = Number.isFinite(margin) ? Math.max(0, margin) : 0;
	return Math.min(z, Math.max(z - m, prev));
}

/** Screen-pixel anchor from a fractional anchor and the canvas size. */
export function anchorPx(anchor: Point, size: { width: number; height: number }): Point {
	return { x: anchor.x * size.width, y: anchor.y * size.height };
}

/** The viewport that pins `cam.focus` to `anchor` (px) at `zoom`, turned by `cam.rotation`. */
export function followViewport(cam: FollowFocus, anchor: Point, zoom: number): Viewport {
	return viewportAnchoredAt(cam.focus, anchor, zoom, cam.rotation);
}

/** True when two viewports are the same to within sub-pixel / sub-degree noise. */
export function sameViewport(a: Viewport, b: Viewport): boolean {
	return (
		Math.abs(a.x - b.x) < 0.01 &&
		Math.abs(a.y - b.y) < 0.01 &&
		Math.abs(a.zoom - b.zoom) < 1e-6 &&
		Math.abs(shortestAngleDelta(a.rotation ?? 0, b.rotation ?? 0)) < 1e-4
	);
}

/**
 * How the 3D view's camera height eases toward the target's ground (see
 * {@link smoothingAlpha}): at its own, never-rigid pace, so a step up a cliff glides.
 */
export const FOLLOW_CAMERA_HEIGHT_SMOOTHING = 0.9;

// ── Driving the board ──

/** What a follow camera follows (world units / degrees). */
export interface FollowTarget {
	x: number;
	y: number;
	/** Which way it faces (deg); used by the `rotate` mode. Default 0. */
	heading?: number;
	/** The height it stands at; the 3D camera follows it (see {@link followCameraHeight}). */
	z?: number;
	/** In the air: the camera height holds (see {@link followCameraHeight}). */
	airborne?: boolean;
}

export interface FollowViewStep {
	mode: FollowViewMode;
	/** Where on screen the target sits (px from the stage's top-left). */
	anchor: Point;
	/** 0 = rigid … 0.99 = heavy lag (see {@link smoothingAlpha}). Default 0. */
	smoothing?: number;
	/**
	 * How high the target may rise in the air before the 3D camera follows it up (see
	 * {@link followCameraHeight}). Default 0. `null` = don't drive the camera height.
	 */
	heightMargin?: number | null;
}

/** A follow camera for a caller with its own frame loop (see the module comment). */
export interface FollowViewDriver {
	/**
	 * One frame of `dt` seconds: ease the viewport toward the target and pin it at the
	 * anchor, and — while the board is (partly) 3D — ease the view's camera to its height.
	 */
	step(target: FollowTarget, dt: number, options: FollowViewStep): void;
	/** Forget the eased camera: the next step starts from what is on screen (no jump). */
	reset(): void;
	/** Stop driving the 3D camera's height (handed back at the board's level). */
	releaseHeight(): void;
	/**
	 * Called when the viewport is moved by something else than this follow, a zoom or the
	 * 3D view's own turn: the user panned to look around. Returns an unsubscribe.
	 */
	onPan(listener: () => void): () => void;
	/** How far the 3D view has turned the viewport by its heading (deg, `0` without one). */
	viewTurn(): number;
	dispose(): void;
}

/** Create a follow camera on a board (its store and services). */
export function createFollowView(board: {
	store: BoardStore;
	services: ServiceRegistry;
}): FollowViewDriver {
	const { store, services } = board;
	let cam: FollowFocus | null = null;
	// The camera height we last gave the 3D view (world units), eased toward the target's
	// ground; `null` while we aren't driving it.
	let cameraHeight: number | null = null;
	// The unsmoothed height it follows (see `followCameraHeight`); `null` while not driving.
	let cameraBase: number | null = null;
	// Set while WE write the viewport, so our own writes don't read as a user pan.
	let writing = false;
	const panListeners = new Set<() => void>();

	const viewTurn = (): number => {
		const t = view3dService.get(services)?.turn?.() ?? 0;
		return Number.isFinite(t) ? t : 0;
	};
	const amount = (): number => view3dService.get(services)?.amount() ?? 0;

	const setCameraHeight = (height: number | null): void => {
		if (height === null) cameraBase = null;
		// While following, the height is re-sent every frame even when unchanged (a 3D view
		// skips a no-op write): that is how the view knows a follower drives it, so its own
		// height keys yield instead of tugging the camera every frame. Letting go (`null`)
		// is sent once.
		if (height === cameraHeight && height === null) return;
		cameraHeight = height;
		view3dService.get(services)?.setCameraHeight?.(height ?? 0);
	};

	const writeViewport = (vp: Viewport): void => {
		writing = true;
		try {
			store.setViewport(vp);
		} finally {
			writing = false;
		}
	};

	// A viewport change we didn't make: a zoom is welcome (the follow keeps the target on
	// its anchor at the new zoom), and so is the 3D view turning the viewport by its
	// heading (the follow turns with it). Anything else is a pan.
	let lastZoom = store.getViewport().zoom;
	let lastRotation = viewportRotation(store.getViewport());
	let lastTurn = viewTurn();
	const offViewport = store.onMutation((e) => {
		if (e.type !== "viewport:changed") return;
		const vp = store.getViewport();
		const zoomChanged = Math.abs(vp.zoom - lastZoom) > 1e-9;
		lastZoom = vp.zoom;
		const rotation = viewportRotation(vp);
		const turned = shortestAngleDelta(lastRotation, rotation);
		lastRotation = rotation;
		const turn = viewTurn();
		const viewTurned = shortestAngleDelta(lastTurn, turn);
		lastTurn = turn;
		if (writing || zoomChanged) return;
		if (turnedByView(turned, viewTurned)) {
			// Carry on from the turned view (the target already includes the turn).
			if (cam) cam = { ...cam, rotation: wrapDeg(cam.rotation + turned) };
			return;
		}
		for (const fn of [...panListeners]) fn();
	});

	return {
		step(target, dt, options) {
			const vp = store.getViewport();
			const anchor = options.anchor;
			const goal: FollowFocus = {
				focus: { x: target.x, y: target.y },
				rotation: wrapDeg(followRotation(options.mode, target.heading ?? 0) + viewTurn()),
			};
			// (Re)seed from what's on screen now, so resuming/switching eases instead of jumping.
			const from = cam ?? {
				focus: screenToWorld(anchor.x, anchor.y, vp),
				rotation: viewportRotation(vp),
			};
			cam = easeFollowFocus(from, goal, smoothingAlpha(options.smoothing ?? 0, dt));
			const next = followViewport(cam, anchor, vp.zoom);
			if (!sameViewport(vp, next)) writeViewport(next);
			// Raise the 3D view's camera with the target, only while the view is (partly) 3D:
			// the flat board has no camera to raise.
			const margin = options.heightMargin === undefined ? 0 : options.heightMargin;
			if (margin !== null && amount() > 0) {
				cameraBase = followCameraHeight(
					cameraBase,
					{ z: target.z ?? 0, airborne: target.airborne ?? false },
					margin,
				);
				const at = cameraHeight ?? 0;
				setCameraHeight(
					at + (cameraBase - at) * smoothingAlpha(FOLLOW_CAMERA_HEIGHT_SMOOTHING, dt),
				);
			} else {
				setCameraHeight(null);
			}
		},
		reset() {
			cam = null;
		},
		releaseHeight() {
			setCameraHeight(null);
		},
		onPan(listener) {
			panListeners.add(listener);
			return () => {
				panListeners.delete(listener);
			};
		},
		viewTurn,
		dispose() {
			offViewport();
			panListeners.clear();
		},
	};
}

export interface FollowViewOptions extends Omit<FollowViewStep, "anchor"> {
	/** Where on screen the target sits (px), read every frame. */
	anchor: () => Point;
	/** Called when the user pans away; following stops. */
	onPan?: () => void;
}

/**
 * Follow `target` with the board's camera on a frame loop of its own until the returned
 * stop is called (or the user pans away). `target` returning `null` skips a frame. The
 * 3D camera's height is handed back when it stops.
 */
export function followView(
	board: { store: BoardStore; services: ServiceRegistry },
	target: () => FollowTarget | null,
	options: FollowViewOptions,
): () => void {
	const driver = createFollowView(board);
	let handle: ReturnType<typeof setTimeout> | number | null = null;
	let last: number | null = null;
	let stopped = false;
	const schedule = (fn: (now: number) => void): void => {
		handle =
			typeof requestAnimationFrame === "function"
				? requestAnimationFrame(fn)
				: setTimeout(() => fn(Date.now()), 16);
	};
	const frame = (now: number): void => {
		handle = null;
		if (stopped) return;
		const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
		last = now;
		const t = target();
		if (t) driver.step(t, dt, { ...options, anchor: options.anchor() });
		schedule(frame);
	};
	const stop = (): void => {
		if (stopped) return;
		stopped = true;
		if (handle !== null) {
			if (typeof cancelAnimationFrame === "function" && typeof handle === "number") {
				cancelAnimationFrame(handle);
			} else clearTimeout(handle as ReturnType<typeof setTimeout>);
		}
		driver.releaseHeight();
		driver.dispose();
	};
	driver.onPan(() => {
		stop();
		options.onPan?.();
	});
	schedule(frame);
	return stop;
}
