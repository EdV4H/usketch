// Pure point math for the Mode 7 tilt (React-free, unit-testable): where a point of
// the flat canvas ends up on screen after `tiltTransform`, and back. Lets a host draw
// things ON the ground (sprites, 3D models, tire marks) or pick the ground point under
// the pointer without re-deriving the CSS transform.
//
// The tilt is `perspective(fov) rotateX(pitch) rotateZ(yaw)` about the origin
// (50% width, `horizon` height), applied right-to-left: rotateZ spins the flat point,
// rotateX tips it back (y → y·cos, z = y·sin), and the perspective divides by
// w = 1 - z / fov. Pass the camera as rendered (`getRenderedCamera`): its `lift` (the
// eye raised above the board) draws everything that many px lower.
import type { Camera } from "./mode7-camera.js";

/** A camera as drawn; `lift` (px, default 0) is how far the eye is raised (see `eyeLiftPx`). */
export type ProjectionCamera = Camera & { lift?: number };

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
export function tiltOrigin(cam: ProjectionCamera, size: StageSize): { x: number; y: number } {
	return { x: size.width / 2, y: size.height * cam.horizon };
}

/**
 * Project a flat-canvas point (px, before the tilt) onto the screen. `null` when the
 * point is at or behind the eye: very NEAR points far below the pivot (the ground
 * tips up past the viewer). Far points only approach the vanishing line.
 *
 * `z` lifts the point off the ground toward the viewer, in px (a depth layer's
 * `translateZ`: height × zoom), so something drawn by other means than the tilted CSS
 * layers (a WebGL terrain mesh) lines up with them. Default 0 (on the ground).
 */
export function projectToGround(
	x: number,
	y: number,
	cam: ProjectionCamera,
	size: StageSize,
	z = 0,
): GroundProjection | null {
	const o = tiltOrigin(cam, size);
	const x0 = x - o.x;
	const y0 = y - o.y;
	const cosYaw = Math.cos(rad(cam.yaw));
	const sinYaw = Math.sin(rad(cam.yaw));
	const x1 = x0 * cosYaw - y0 * sinYaw;
	const y1 = x0 * sinYaw + y0 * cosYaw;
	// rotateX(pitch) of (y1, z): y' = y·cos − z·sin, z' = y·sin + z·cos
	const cosPitch = Math.cos(rad(cam.pitch));
	const sinPitch = Math.sin(rad(cam.pitch));
	const h = z - (cam.lift ?? 0);
	const y2 = y1 * cosPitch - h * sinPitch;
	const z2 = y1 * sinPitch + h * cosPitch;
	const w = 1 - z2 / cam.fov;
	if (w <= 0) return null;
	return { x: o.x + x1 / w, y: o.y + y2 / w, depth: z2, scale: 1 / w };
}

/**
 * The flat-canvas point (px, before the tilt) drawn at a screen point — the inverse
 * of `projectToGround` for points `z` px off the ground (default 0). `null` above the
 * vanishing line (sky: no ground there) or where that height is at or behind the eye.
 */
export function unprojectFromGround(
	x: number,
	y: number,
	cam: ProjectionCamera,
	size: StageSize,
	z = 0,
): { x: number; y: number } | null {
	const o = tiltOrigin(cam, size);
	const px = x - o.x;
	const py = y - o.y;
	const cosPitch = Math.cos(rad(cam.pitch));
	const sinPitch = Math.sin(rad(cam.pitch));
	const h = z - (cam.lift ?? 0);
	const denominator = cosPitch + (py * sinPitch) / cam.fov;
	if (denominator <= 0) return null;
	// py·w = y1·cos − h·sin with w = 1 − (y1·sin + h·cos) / fov, solved for y1.
	const y1 = (py + h * sinPitch - (py * h * cosPitch) / cam.fov) / denominator;
	const w = 1 - (y1 * sinPitch + h * cosPitch) / cam.fov;
	if (w <= 0) return null;
	const x1 = px * w;
	const cosYaw = Math.cos(rad(cam.yaw));
	const sinYaw = Math.sin(rad(cam.yaw));
	return { x: o.x + x1 * cosYaw + y1 * sinYaw, y: o.y - x1 * sinYaw + y1 * cosYaw };
}
