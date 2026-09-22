// Pure CSS-string builders for the Mode 7 view (React-free, unit-testable). Turns a
// Camera into the CSS 3D properties applied to the stage (canvas container) and the
// tilted layer wrappers, plus the sky / fog gradients painted behind and in front.
//
// The tilt is a self-contained transform applied to each selected layer wrapper:
//   perspective(fov) rotateX(pitch) rotateZ(yaw)
// The `perspective()` FUNCTION (rather than a `perspective` property on a parent) is
// used deliberately — it foreshortens the wrapper's own rotateX without depending on
// the wrapper being a direct child of a perspective element, which is what actually
// makes the plane recede in 3D. yaw spins the flat board (heading), pitch tilts it
// back into a ground plane. The pivot is a horizontal line at `horizon` (origin Y),
// so content above it recedes toward the vanishing line and below comes toward the
// viewer.
import type { Camera } from "./mode7-camera.js";

export interface TiltTransform {
	/** `transform` for a tilted layer wrapper (includes its own perspective). */
	transform: string;
	/** `transform-origin` — pivots the tilt about the horizon line. */
	transformOrigin: string;
}

/** The full CSS transform (perspective + rotate) for a tilted layer wrapper. */
export function tiltTransform(cam: Camera): TiltTransform {
	return {
		transform: `perspective(${round(cam.fov)}px) rotateX(${round(cam.pitch)}deg) rotateZ(${round(cam.yaw)}deg)`,
		transformOrigin: `50% ${round(cam.horizon * 100)}%`,
	};
}

/**
 * Vertical blend band (in % of viewport height) straddling the horizon. The sky and
 * fog gradients fade THROUGH the horizon over this band instead of stopping hard at
 * it — otherwise the tilted plane's far edge (layers only paint the finite 2D
 * viewport rect) shows as a crisp horizontal seam. A soft band hazes that edge away.
 */
const HORIZON_SOFT = 8;

/**
 * Sky backdrop (painted behind the tilted plane): a vertical gradient from the sky
 * color at the top down to a paler haze that fades out smoothly ACROSS the horizon,
 * so the ground appears to dissolve into a hazy sky rather than meeting a hard line.
 * Fully transparent a little below the horizon (the near ground shows through).
 */
export function skyBackground(sky: string, horizon: number): string {
	const h = round(clamp01(horizon) * 100);
	const mid = round(Math.min(h * 0.5, h - HORIZON_SOFT));
	const hazeTop = round(clamp(h - HORIZON_SOFT, 0, 100));
	const clearBottom = round(clamp(h + HORIZON_SOFT, 0, 100));
	return `linear-gradient(to bottom, ${sky} 0%, ${sky} ${mid}%, ${haze(sky)} ${hazeTop}%, transparent ${clearBottom}%)`;
}

/**
 * Fog overlay (painted in front of the plane): a haze that FADES IN from a little
 * above the horizon, peaks right at it, and clears toward the bottom (the camera).
 * The soft top edge (above the horizon) is what covers the ground plane's far edge,
 * hiding the seam; the fade to the bottom sells atmospheric depth. `density` 0..1
 * scales the peak alpha; 0 disables it entirely.
 */
export function fogBackground(color: string, density: number, horizon: number): string {
	const h = round(clamp01(horizon) * 100);
	const a = clamp01(density);
	const fadeInTop = round(clamp(h - HORIZON_SOFT, 0, 100));
	return `linear-gradient(to bottom, transparent ${fadeInTop}%, ${rgba(color, a)} ${h}%, transparent 100%)`;
}

/** Peak fog opacity for the overlay element (kept separate so 0 density → no paint). */
export function fogOpacity(density: number): number {
	return clamp01(density);
}

/**
 * Draw-distance clip for the tilted layer wrappers: a `clip-path` that cuts off the
 * FAR part of the ground (the top of the wrapper box, which the tilt sends toward the
 * horizon) so distant content isn't drawn. `drawDistance` 0..1 is how far toward the
 * horizon to draw (1 = all the way, no clip → returns `null`; smaller = closer cutoff).
 * The cut line runs from the horizon (at full) down toward the near edge (at 0), so it
 * only ever bites into the ground, never the near foreground. Empirically `clip-path`
 * on the tilted wrapper keeps the 3D tilt intact (unlike `overflow`, which flattens).
 */
export function drawDistanceClip(drawDistance: number, horizon: number): string | null {
	const d = clamp01(drawDistance);
	if (d >= 1) return null;
	const h = round(clamp01(horizon) * 100);
	const insetTop = round(h + (1 - d) * (100 - h));
	return `inset(${insetTop}% 0% 0% 0%)`;
}

// ── helpers ──

function round(n: number): number {
	return Math.round(n * 1000) / 1000;
}

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(1, Math.max(0, n));
}

function clamp(n: number, lo: number, hi: number): number {
	if (!Number.isFinite(n)) return lo;
	return Math.min(hi, Math.max(lo, n));
}

/** A translucent version of the sky color for the horizon haze band. */
function haze(sky: string): string {
	return rgba(sky, 0.35);
}

/**
 * Wrap a CSS color into an rgba() with the given alpha. Handles #rgb/#rrggbb; any
 * other color string is passed through `color-mix` with transparent so named/hsl
 * colors still fade (falls back to the raw color if color-mix is unsupported).
 */
export function rgba(color: string, alpha: number): string {
	const a = clamp01(alpha);
	const hex = color.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
	if (hex) {
		const h = hex[1];
		const full = h.length === 3 ? h.replace(/(.)/g, "$1$1") : h;
		const r = Number.parseInt(full.slice(0, 2), 16);
		const g = Number.parseInt(full.slice(2, 4), 16);
		const b = Number.parseInt(full.slice(4, 6), 16);
		return `rgba(${r}, ${g}, ${b}, ${a})`;
	}
	return `color-mix(in srgb, ${color} ${round(a * 100)}%, transparent)`;
}
