// Reusable viewport-constraint helpers built on `BoardStore.setViewportConstraint`.
// A "canvas bounds" / scroll-region limit is a common need (dashboards, fixed
// layouts, embeds), so the math lives here for any plugin or host to compose,
// rather than being re-derived per feature.
import type { BoundingBox, Viewport, ViewportConstraint } from "@edv4h/usketch-shared";

/** Clamp on a single axis to `[min, max]`; when the range is inverted (the content
 *  is smaller than the screen on that axis) pin to `max` (top-/left-aligned). */
function clampAxis(v: number, min: number, max: number): number {
	const r = min > max ? max : v < min ? min : v > max ? max : v;
	return r === 0 ? 0 : r; // normalize -0 → 0
}

/**
 * Clamp a viewport's PAN so the visible region stays within `bounds` (a world-space
 * rectangle), given the canvas pixel `viewportSize`. Zoom is left unchanged. You
 * can't scroll to reveal anything left/above `bounds`, and scrolling stops at its
 * right/bottom edges. When the content is smaller than the screen on an axis, that
 * axis is pinned so the bounds' top-left stays anchored.
 *
 * (Screen maps to world as `screen = viewport.{x,y} + world * zoom`, so the world
 * point at screen 0 is `-viewport.{x,y} / zoom`.)
 */
export function clampViewportToBounds(
	vp: Viewport,
	bounds: BoundingBox,
	viewportSize: { width: number; height: number },
): Viewport {
	const zoom = vp.zoom;
	const right = bounds.x + bounds.width;
	const bottom = bounds.y + bounds.height;
	return {
		x: clampAxis(vp.x, viewportSize.width - right * zoom, -bounds.x * zoom),
		y: clampAxis(vp.y, viewportSize.height - bottom * zoom, -bounds.y * zoom),
		zoom,
	};
}

/**
 * Build a {@link ViewportConstraint} that keeps the viewport within `getBounds()`
 * using `getViewportSize()` (both read live per commit, so a resizing canvas or
 * growing content are handled). Returns the viewport unchanged when either is
 * unavailable. Install with `store.setViewportConstraint(boundsConstraint({...}))`.
 */
export function boundsConstraint(opts: {
	getBounds: () => BoundingBox | null;
	getViewportSize: () => { width: number; height: number } | null;
}): ViewportConstraint {
	return (vp) => {
		const bounds = opts.getBounds();
		const size = opts.getViewportSize();
		if (!bounds || !size) return vp;
		return clampViewportToBounds(vp, bounds, size);
	};
}
