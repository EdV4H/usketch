// Pure CSS-string builders for the Mode 7 view (React-free, unit-testable). Turns a
// Camera into the CSS 3D properties applied to the stage (canvas container) and the
// tilted layer wrappers, plus the sky / fog gradients painted behind and in front.
//
// Canonical 3D scene: `perspective` lives on the STAGE (one shared vanishing point
// for every tilted layer), and each layer wrapper carries `rotateX(pitch)
// rotateZ(yaw)`. yaw spins the flat board (heading), pitch tilts it back into a
// ground plane, and the shared perspective foreshortens it so far parts recede to
// the horizon. The pivot is a horizontal line at `horizon` (origin Y), so content
// above it recedes toward the vanishing line and content below comes toward the
// viewer.
import type { Camera } from "./mode7-camera.js";

export interface StageStyle {
	/** `perspective` for the stage (canvas container). */
	perspective: string;
	/** `perspective-origin` — the vanishing point (horizon). */
	perspectiveOrigin: string;
}

export interface LayerTilt {
	/** `transform` for a tilted layer wrapper. */
	transform: string;
	/** `transform-origin` — pivots the tilt about the horizon line. */
	transformOrigin: string;
}

/** The perspective the stage container applies to all tilted layers. */
export function stageStyle(cam: Camera): StageStyle {
	return {
		perspective: `${round(cam.fov)}px`,
		perspectiveOrigin: `50% ${round(cam.horizon * 100)}%`,
	};
}

/** The rotate transform each selected layer wrapper carries. */
export function layerTilt(cam: Camera): LayerTilt {
	return {
		transform: `rotateX(${round(cam.pitch)}deg) rotateZ(${round(cam.yaw)}deg)`,
		transformOrigin: `50% ${round(cam.horizon * 100)}%`,
	};
}

/**
 * Sky backdrop (painted behind the tilted plane): a vertical gradient from the sky
 * color at the top down to a paler haze at the horizon line, so the ground appears
 * to meet a sky. Below the horizon is transparent (the ground shows through).
 */
export function skyBackground(sky: string, horizon: number): string {
	const h = round(clamp01(horizon) * 100);
	return `linear-gradient(to bottom, ${sky} 0%, ${sky} ${round(h * 0.55)}%, ${haze(sky)} ${h}%, transparent ${h}%)`;
}

/**
 * Fog overlay (painted in front of the plane): a haze that is densest right at the
 * horizon and clears toward the bottom (the camera), selling atmospheric depth.
 * `density` 0..1 scales the peak alpha; 0 disables it. Above the horizon is
 * transparent so it never dims the sky.
 */
export function fogBackground(color: string, density: number, horizon: number): string {
	const h = round(clamp01(horizon) * 100);
	const a = clamp01(density);
	return `linear-gradient(to bottom, transparent ${h}%, ${rgba(color, a)} ${h}%, transparent 100%)`;
}

/** Peak fog opacity for the overlay element (kept separate so 0 density → no paint). */
export function fogOpacity(density: number): number {
	return clamp01(density);
}

// ── helpers ──

function round(n: number): number {
	return Math.round(n * 1000) / 1000;
}

function clamp01(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(1, Math.max(0, n));
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
