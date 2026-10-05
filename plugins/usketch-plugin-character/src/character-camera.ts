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
