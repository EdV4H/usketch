// Pure point math for the Mode 7 tilt (React-free, unit-testable): where a point of
// the flat canvas ends up on screen after `tiltTransform`, and back. Lets a host draw
// things ON the ground (sprites, 3D models, tire marks) or pick the ground point under
// the pointer without re-deriving the CSS transform.
//
// The tilt is `perspective(fov) rotateX(pitch) rotateZ(yaw)` about the origin
// (50% width, `horizon` height), applied right-to-left: rotateZ spins the flat point,
// rotateX tips it back (y → y·cos, z = y·sin), and the perspective divides by
// w = 1 - z / fov. Pass the camera as rendered (see `transitionCamera`).
import type { Camera } from "./mode7-camera.js";

/** Canvas size in px (the stage the tilted layers fill). */
export interface StageSize {
	width: number;
	height: number;
}

/** A flat-canvas point as seen through the tilt. */
export interface GroundProjection {
	/** Screen position, px from the canvas top-left. */
	x: number;
	y: number;
	/** Height toward the viewer, px (larger = nearer). Use it for draw order. */
	depth: number;
	/** Apparent scale at this point (1 / w). 1 on a flat (pitch 0) view. */
	scale: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** The transform origin (pivot), px from the canvas top-left. */
export function tiltOrigin(cam: Camera, size: StageSize): { x: number; y: number } {
	return { x: size.width / 2, y: size.height * cam.horizon };
}

/**
 * Project a flat-canvas point (px, before the tilt) onto the screen. `null` when the
 * point is behind the eye (beyond the vanishing line).
 */
export function projectToGround(
	x: number,
	y: number,
	cam: Camera,
	size: StageSize,
): GroundProjection | null {
	const o = tiltOrigin(cam, size);
	const x0 = x - o.x;
	const y0 = y - o.y;
	const cosYaw = Math.cos(rad(cam.yaw));
	const sinYaw = Math.sin(rad(cam.yaw));
	const x1 = x0 * cosYaw - y0 * sinYaw;
	const y1 = x0 * sinYaw + y0 * cosYaw;
	const y2 = y1 * Math.cos(rad(cam.pitch));
	const z2 = y1 * Math.sin(rad(cam.pitch));
	const w = 1 - z2 / cam.fov;
	if (w <= 0) return null;
	return { x: o.x + x1 / w, y: o.y + y2 / w, depth: z2, scale: 1 / w };
}

/**
 * The flat-canvas point (px, before the tilt) drawn at a screen point — the inverse
 * of `projectToGround`. `null` above the vanishing line (sky: no ground there).
 */
export function unprojectFromGround(
	x: number,
	y: number,
	cam: Camera,
	size: StageSize,
): { x: number; y: number } | null {
	const o = tiltOrigin(cam, size);
	const px = x - o.x;
	const py = y - o.y;
	const cosPitch = Math.cos(rad(cam.pitch));
	const sinPitch = Math.sin(rad(cam.pitch));
	const denominator = cosPitch + (py * sinPitch) / cam.fov;
	if (denominator <= 0) return null;
	const y1 = py / denominator;
	const x1 = px * (1 - (y1 * sinPitch) / cam.fov);
	const cosYaw = Math.cos(rad(cam.yaw));
	const sinYaw = Math.sin(rad(cam.yaw));
	return { x: o.x + x1 * cosYaw + y1 * sinYaw, y: o.y - x1 * sinYaw + y1 * cosYaw };
}
