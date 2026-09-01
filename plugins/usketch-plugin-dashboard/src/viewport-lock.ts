// Constrain the canvas viewport to the grid, per the config's `viewportLock`:
//   - `vertical` — fit the grid WIDTH to the screen, lock zoom, scroll vertically
//     only (horizontal pan is pinned so the grid's left edge stays at screen left).
//   - `both` — fit the grid width + lock zoom, but allow panning both axes.
//   - `off` — no constraint.
//
// It clamps reactively: on every `viewport:changed` it re-applies the constraint
// (so a user pan/zoom that violates it snaps back). Its own `setViewport` is
// guarded so it can't loop. The canvas pixel size is measured from the DOM (the
// canvas engine tags its container `data-testid="canvas-container"`).
import type { BoardStore, PluginContext } from "@edv4h/usketch-shared";
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

/** Compute the constrained viewport for the current mode, or null when nothing to
 *  constrain (mode off / not a dashboard / canvas unmeasured / bad numbers). */
function constrained(store: BoardStore): { x: number; y: number; zoom: number } | null {
	const mode = viewportLockOf(store);
	if (mode === "off") return null;
	const config = getDashboardConfig(store);
	if (!config) return null;
	const size = canvasSize();
	if (!size) return null;
	const spec = gridSpecFromConfig(config);
	const width = gridWidthWorld(spec);
	if (width <= 0) return null;
	const fitZoom = size.width / width;
	if (!Number.isFinite(fitZoom) || fitZoom <= 0) return null;

	const cur = store.getViewport();
	// Align the grid's left edge (originX) to screen x=0 for horizontal lock.
	const alignedX = -spec.originX * fitZoom;
	return {
		x: mode === "vertical" ? alignedX : cur.x, // `both` leaves horizontal free
		y: cur.y, // vertical scroll is always free
		zoom: fitZoom, // zoom is always locked to fit-width
	};
}

/** Wire the viewport constraint. Returns a teardown. */
export function setupViewportLock(ctx: PluginContext): () => void {
	let applying = false;
	function clampNow(): void {
		if (applying) return;
		const target = constrained(ctx.store);
		if (!target) return;
		const cur = ctx.store.getViewport();
		if (cur.x === target.x && cur.y === target.y && cur.zoom === target.zoom) return;
		applying = true;
		try {
			ctx.store.setViewport(target);
		} finally {
			applying = false;
		}
	}

	const offMutation = ctx.store.onMutation((event) => {
		if (event.type === "viewport:changed") {
			clampNow();
		} else if (event.type === "shape:updated" && isDashboardConfig(event.payload.after)) {
			clampNow(); // config (mode / columns / cell / origin) changed → re-fit
		}
	});

	// Re-fit when the canvas resizes.
	let resizeObserver: ResizeObserver | null = null;
	if (typeof document !== "undefined" && typeof ResizeObserver !== "undefined") {
		const el = document.querySelector('[data-testid="canvas-container"]');
		if (el) {
			resizeObserver = new ResizeObserver(() => clampNow());
			resizeObserver.observe(el);
		}
	}

	// Initial fit once the canvas has (likely) been measured.
	const raf =
		typeof globalThis.requestAnimationFrame === "function"
			? globalThis.requestAnimationFrame(clampNow)
			: (globalThis.setTimeout(clampNow, 0) as unknown as number);

	return () => {
		offMutation();
		resizeObserver?.disconnect();
		if (typeof globalThis.cancelAnimationFrame === "function") globalThis.cancelAnimationFrame(raf);
		else globalThis.clearTimeout(raf);
	};
}
