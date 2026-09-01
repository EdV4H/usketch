// Constrain the canvas viewport to the grid, per the config's `viewportLock`:
//   - `vertical` — fit the grid WIDTH to the screen, lock zoom, scroll vertically
//     only (horizontal pan is pinned so the grid's left edge stays at screen left).
//   - `both` — fit the grid width + lock zoom, but allow panning both axes.
//   - `off` — no constraint.
//
// It installs a `store.setViewportConstraint`, which the store applies inside its
// single viewport-commit path — so every pan/zoom is constrained AT COMMIT and the
// stored viewport can never violate it (no fighting an after-the-fact clamp). The
// constraint reads live config + a DOM-measured canvas size each call, so config
// and resize changes take effect on the next commit; we re-commit explicitly so
// they snap immediately.
import type { PluginContext, Viewport } from "@edv4h/usketch-shared";
import { getDashboardConfig, gridSpecFromConfig, viewportLockOf } from "./config-ops.js";
import { isDashboardConfig } from "./dashboard-config-shape.js";
import type { GridSpec } from "./grid.js";

/** Measure the canvas area in CSS pixels, or null when unavailable. Prefers the
 *  largest `canvas-container` (a minimap tags one too); falls back to the window. */
function canvasSize(): { width: number; height: number } | null {
	if (typeof document !== "undefined") {
		let best: { width: number; height: number } | null = null;
		for (const el of document.querySelectorAll('[data-testid="canvas-container"]')) {
			const r = el.getBoundingClientRect();
			if (r.width > 0 && r.height > 0 && (!best || r.width * r.height > best.width * best.height)) {
				best = { width: r.width, height: r.height };
			}
		}
		if (best) return best;
	}
	if (typeof window !== "undefined" && window.innerWidth > 0) {
		return { width: window.innerWidth, height: window.innerHeight };
	}
	return null;
}

/** The grid's total width in world units (padding + columns + gaps). */
function gridWidthWorld(spec: GridSpec): number {
	const cols = Math.max(1, Math.floor(spec.columns));
	return 2 * spec.padding + cols * spec.cellW + (cols - 1) * spec.gap;
}

/** Wire the viewport constraint. Returns a teardown. */
export function setupViewportLock(ctx: PluginContext): () => void {
	const constrain = (vp: Viewport): Viewport => {
		const mode = viewportLockOf(ctx.store);
		if (mode === "off") return vp;
		const config = getDashboardConfig(ctx.store);
		if (!config) return vp;
		const size = canvasSize();
		if (!size) return vp;
		const spec = gridSpecFromConfig(config);
		const width = gridWidthWorld(spec);
		if (width <= 0) return vp;
		const fitZoom = size.width / width; // fit grid width to the screen
		if (!Number.isFinite(fitZoom) || fitZoom <= 0) return vp;
		const alignedX = -spec.originX * fitZoom; // grid left edge at screen x=0
		return {
			x: mode === "vertical" ? alignedX : vp.x, // `both` leaves horizontal free
			y: vp.y, // vertical scroll always free
			zoom: fitZoom, // zoom always locked to fit-width
		};
	};

	ctx.store.setViewportConstraint(constrain);

	// Re-commit the current viewport so it snaps when the config (mode / columns /
	// cell / origin) changes or the canvas resizes.
	const reapply = () => ctx.store.setViewport(ctx.store.getViewport());
	const offMutation = ctx.store.onMutation((event) => {
		if (event.type === "shape:updated" && isDashboardConfig(event.payload.after)) reapply();
	});

	let resizeObserver: ResizeObserver | null = null;
	if (typeof document !== "undefined" && typeof ResizeObserver !== "undefined") {
		const el = document.querySelector('[data-testid="canvas-container"]');
		if (el) {
			resizeObserver = new ResizeObserver(reapply);
			resizeObserver.observe(el);
		}
	}

	return () => {
		offMutation();
		resizeObserver?.disconnect();
		ctx.store.setViewportConstraint(null);
	};
}
