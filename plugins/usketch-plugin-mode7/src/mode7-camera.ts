// Pure, React-free camera model for the Mode 7 view (so the runtime, service, HUD,
// and unit tests import it without pulling in React). The camera is GEOMETRY only —
// it describes how the flat board plane is tilted into a receding ground plane:
//   - pitch   … ground tilt in degrees (0 = flat top-down, higher = more oblique)
//   - yaw     … heading rotation in degrees (spin the ground around the view axis)
//   - fov     … CSS `perspective()` distance in px (smaller = stronger perspective)
//   - horizon … pivot line as a fraction of viewport height (0=top … 1=bottom);
//               where the ground meets the sky after the tilt.
// Appearance (sky color, fog) is separate — see `mode7-transform.ts`.

export interface Camera {
	pitch: number;
	yaw: number;
	fov: number;
	horizon: number;
}

/** The camera as drawn: {@link Camera} plus how far the eye is raised (see `eyeLiftPx`). */
export interface RenderedCamera extends Camera {
	/** Screen px the eye is raised above the board: everything is drawn this much lower. */
	lift: number;
}

/** Largest eye height accepted (world units), far above any terrain. */
export const MAX_EYE_HEIGHT = 100_000;

/** Keep an eye height usable: finite, within ±{@link MAX_EYE_HEIGHT}; anything else is 0. */
export function clampEyeHeight(height: number): number {
	if (!Number.isFinite(height)) return 0;
	return Math.min(MAX_EYE_HEIGHT, Math.max(-MAX_EYE_HEIGHT, height));
}

/**
 * Screen px the eye is raised for an eye `height` (world units) at `zoom`, faded with the
 * transition `amount` so the flat board (0) is never shifted.
 */
export function eyeLiftPx(height: number, zoom: number, amount: number): number {
	const a = Math.min(1, Math.max(0, Number.isFinite(amount) ? amount : 0));
	const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
	return clampEyeHeight(height) * z * a;
}

/** Allowed ranges. pitch stays < 90 so the plane never goes fully edge-on
 *  (which would collapse to a line); horizon stays off the very edges. */
export const CAMERA_LIMITS = {
	pitch: { min: 0, max: 85 },
	fov: { min: 200, max: 2000 },
	horizon: { min: 0.1, max: 0.9 },
} as const;

export const DEFAULT_CAMERA: Camera = { pitch: 55, yaw: 0, fov: 600, horizon: 0.45 };

function clamp(v: number, min: number, max: number): number {
	if (!Number.isFinite(v)) return min;
	return Math.min(max, Math.max(min, v));
}

/** Wrap a degree value into (-180, 180]. */
export function wrapDeg(deg: number): number {
	if (!Number.isFinite(deg)) return 0;
	let d = deg % 360;
	if (d > 180) d -= 360;
	if (d <= -180) d += 360;
	return d;
}

/** Clamp every field to its valid range (pitch/fov/horizon clamped, yaw wrapped). */
export function clampCamera(c: Camera): Camera {
	return {
		pitch: clamp(c.pitch, CAMERA_LIMITS.pitch.min, CAMERA_LIMITS.pitch.max),
		yaw: wrapDeg(c.yaw),
		fov: clamp(c.fov, CAMERA_LIMITS.fov.min, CAMERA_LIMITS.fov.max),
		horizon: clamp(c.horizon, CAMERA_LIMITS.horizon.min, CAMERA_LIMITS.horizon.max),
	};
}

/** Apply a partial change and re-clamp. Non-finite inputs fall back to limits. */
export function updateCamera(c: Camera, patch: Partial<Camera>): Camera {
	return clampCamera({ ...c, ...patch });
}

/** Nudge fields by deltas (e.g. from keyboard actions) and re-clamp. */
export function adjustCamera(c: Camera, delta: Partial<Camera>): Camera {
	return clampCamera({
		pitch: c.pitch + (delta.pitch ?? 0),
		yaw: c.yaw + (delta.yaw ?? 0),
		fov: c.fov + (delta.fov ?? 0),
		horizon: c.horizon + (delta.horizon ?? 0),
	});
}
