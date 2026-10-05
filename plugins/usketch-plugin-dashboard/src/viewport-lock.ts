// Constrain the canvas viewport when the config's scroll-limit (`viewportLock`) is
// ON. Zoom is always locked to 100%. The CELL WIDTH decides the mode:
//   - "auto" width → VERTICAL-ONLY: the width auto-fits the screen (so the grid
//     exactly fills it — no horizontal room), x pinned at the grid's left edge,
//     only vertical panning (clamped to the content).
//   - fixed numeric width → BOTH axes: the grid keeps its fixed width, and both
//     axes pan within the content bounds — so a grid wider or taller than the
//     screen is reachable (horizontal scroll), but you can't scroll into the empty
//     margins.
//
// It installs a `store.setViewportConstraint`, applied inside the store's single
// viewport-commit path — so every pan/zoom is constrained AT COMMIT and the stored
// viewport can never violate it. The auto cell-width is applied transiently (no undo
// entry) whenever auto engages, the canvas resizes, or columns/gap/padding change.
import type { BoardStore, BoundingBox, PluginContext, Viewport } from "@edv4h/usketch-shared";
import { clampViewportToBounds } from "@edv4h/usketch-store";
import {
	cellWAutoOf,
	getDashboardConfig,
	gridSpecFromConfig,
	viewportLockOf,
} from "./config-ops.js";
import { isDashboardConfig } from "./dashboard-config-shape.js";
import { repackBoardTransient, runGuarded } from "./dashboard-runtime.js";
import { type GridSpec, spanOf } from "./grid.js";
import { allDashboardItems, dashboardItems } from "./items.js";

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

/** The cell width that makes the grid exactly fill `screenWidth` at 100% zoom, or
 *  null when it can't (too many columns / no room). */
function autoCellWidth(spec: GridSpec, screenWidth: number): number | null {
	const cols = Math.max(1, Math.floor(spec.columns));
	const w = (screenWidth - 2 * spec.padding - (cols - 1) * spec.gap) / cols;
	return Number.isFinite(w) && w > 0 ? w : null;
}

/** The scrollable content rectangle in world units: the grid origin (top-left) out
 *  to the far edges of all shapes (so you can't scroll into the empty space above /
 *  left of the grid, and stop at the right / bottom of the content). */
function contentBounds(store: BoardStore, spec: GridSpec): BoundingBox {
	let right = spec.originX + gridWidthWorld(spec); // at least the grid's own width
	let bottom = spec.originY + 2 * spec.padding + spec.cellH; // at least one row tall
	for (const s of allDashboardItems(store)) {
		if (s.x + s.width > right) right = s.x + s.width;
		if (s.y + s.height > bottom) bottom = s.y + s.height;
	}
	return {
		x: spec.originX,
		y: spec.originY,
		width: right + spec.padding - spec.originX,
		height: bottom + spec.padding - spec.originY,
	};
}

/** Wire the viewport constraint. Returns a teardown. */
export function setupViewportLock(ctx: PluginContext): () => void {
	// Raised while we write the auto cell-width, so our own config-change listener
	// doesn't recurse.
	let applyingAuto = false;

	const constrain = (vp: Viewport): Viewport => {
		if (!viewportLockOf(ctx.store)) return vp;
		const config = getDashboardConfig(ctx.store);
		if (!config) return vp;
		const size = canvasSize();
		if (!size) return vp;
		const spec = gridSpecFromConfig(config); // cellW already auto-fit by reapply
		const bounds = contentBounds(ctx.store, spec);
		if (cellWAutoOf(ctx.store)) {
			// AUTO width: fit to screen → 100% zoom, x pinned at the grid's left edge,
			// vertical scroll only.
			const clamped = clampViewportToBounds({ x: -spec.originX, y: vp.y, zoom: 1 }, bounds, size);
			return { x: -spec.originX, y: clamped.y, zoom: 1 };
		}
		// FIXED numeric width: 100% zoom, pan BOTH axes within the content bounds
		// (horizontal scroll when the grid is wider than the screen).
		return clampViewportToBounds({ x: vp.x, y: vp.y, zoom: 1 }, bounds, size);
	};

	ctx.store.setViewportConstraint(constrain);

	/** When "auto" width is on, size the cell width so the grid fills the screen AND
	 *  grow/shrink every item to its cell width (span preserved, height untouched),
	 *  then repack — transiently (no undo entry, ignored by the reflow runtime).
	 *  Independent of the scroll-limit: turning on "幅Auto" fits even when the
	 *  scroll-limit is off. No-op when the width isn't auto. */
	function applyAutoWidth(): void {
		if (!cellWAutoOf(ctx.store)) return;
		const config = getDashboardConfig(ctx.store);
		const size = canvasSize();
		if (!config || !size) return;
		const oldSpec = gridSpecFromConfig(config);
		const autoW = autoCellWidth(oldSpec, size.width);
		if (autoW === null) return;
		const newSpec = gridSpecFromConfig({ ...config, cellW: autoW } as typeof config);
		applyingAuto = true;
		try {
			runGuarded(() => {
				if (Math.abs(config.cellW - autoW) >= 0.5) {
					ctx.store.updateShape(config.id, { cellW: autoW } as Partial<typeof config>);
				}
				// Resize each item's WIDTH to its (preserved) column span under the new
				// cell width; height stays (cell height isn't auto).
				for (const s of dashboardItems(ctx.store)) {
					const span = spanOf(s.width, s.height, oldSpec);
					const newW = span.cols * newSpec.cellW + (span.cols - 1) * newSpec.gap;
					if (Math.abs(s.width - newW) >= 0.5) ctx.store.updateShape(s.id, { width: newW });
				}
			});
			repackBoardTransient(ctx);
		} finally {
			applyingAuto = false;
		}
	}

	// Re-fit the auto width and re-commit whenever the lock/auto flags toggle, the
	// config (columns / gap / padding) changes, or the canvas resizes.
	const reapply = () => {
		applyAutoWidth();
		ctx.store.setViewport(ctx.store.getViewport());
	};

	// Coalesce resize-driven reapplies to one per frame (a window/observer resize
	// fires a burst; each reapply repacks, so we don't want one per event).
	let rafPending = false;
	const scheduleReapply = () => {
		if (rafPending) return;
		rafPending = true;
		const run = () => {
			rafPending = false;
			reapply();
		};
		if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
		else setTimeout(run, 16);
	};

	const offMutation = ctx.store.onMutation((event) => {
		if (applyingAuto) return; // ignore our own auto-width write
		if (event.type === "shape:updated" && isDashboardConfig(event.payload.after)) reapply();
	});

	// Refit on canvas resize. Observe the canvas element when present, AND always
	// listen to window resize — the container may not exist at setup, or may not
	// track the window, so the window listener is the reliable fallback.
	let resizeObserver: ResizeObserver | null = null;
	if (typeof document !== "undefined" && typeof ResizeObserver !== "undefined") {
		const el = document.querySelector('[data-testid="canvas-container"]');
		if (el) {
			resizeObserver = new ResizeObserver(scheduleReapply);
			resizeObserver.observe(el);
		}
	}
	const onWindowResize = typeof window !== "undefined" ? scheduleReapply : null;
	if (onWindowResize) window.addEventListener("resize", onWindowResize);

	return () => {
		offMutation();
		resizeObserver?.disconnect();
		if (onWindowResize) window.removeEventListener("resize", onWindowResize);
		ctx.store.setViewportConstraint(null);
	};
}
