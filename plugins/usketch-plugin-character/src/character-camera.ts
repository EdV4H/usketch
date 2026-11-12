// Pure follow-camera math: where the viewport should be so the character sits at
// its screen anchor, optionally turning the world so the character faces up.
import {
	type Point,
	shortestAngleDelta,
	type Viewport,
	viewportAnchoredAt,
	wrapDeg,
} from "@edv4h/usketch-shared";

/**
 * - `fixed`:  follow; the world stays axis-aligned (rotation 0) and the character
 *             turns on screen.
 * - `rotate`: follow AND turn the world by `-heading`, so the character always
 *             faces screen-up (racing view).
 * - `free`:   don't touch the camera.
 */
export type CameraMode = "fixed" | "rotate" | "free";

/** The smoothed camera target: the world point pinned to the anchor + rotation. */
export interface CameraFocus {
	focus: Point;
	rotation: number;
}

/** The camera rotation a mode wants for a heading. */
export function targetRotation(mode: CameraMode, heading: number): number {
	return mode === "rotate" ? wrapDeg(-heading) : 0;
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
export function easeFocus(current: CameraFocus, target: CameraFocus, alpha: number): CameraFocus {
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
 * - On the ground: the ground the character stands on (`pose.z`).
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

/**
 * The default `cameraHeightMargin`: the highest an ordinary jump goes (the jump's apex,
 * or the drift hop), so those never move the camera. `0` without jumping.
 */
export function defaultCameraHeightMargin(jumpHeight: number | null, hopHeight: number): number {
	return Math.max(0, jumpHeight ?? 0, hopHeight);
}

/** Screen-pixel anchor from a fractional anchor and the canvas size. */
export function anchorPx(anchor: Point, size: { width: number; height: number }): Point {
	return { x: anchor.x * size.width, y: anchor.y * size.height };
}

/** The viewport that pins `cam.focus` to `anchor` (px) at `zoom`, turned by `cam.rotation`. */
export function followViewport(cam: CameraFocus, anchor: Point, zoom: number): Viewport {
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
