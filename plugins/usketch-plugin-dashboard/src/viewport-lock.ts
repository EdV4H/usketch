// Constrain the canvas viewport when the config's scroll-limit (`viewportLock`) is
// ON: zoom is locked to 100% and the CELL WIDTH is auto-sized so the grid exactly
// fills the screen width — so there's no horizontal room (x is pinned) and you
// scroll vertically only, bounded to the content. When OFF, no constraint.
//
// It installs a `store.setViewportConstraint`, applied inside the store's single
// viewport-commit path — so every pan/zoom is constrained AT COMMIT and the stored
// viewport can never violate it. The auto cell-width is applied transiently (no undo
// entry) whenever the lock engages, the canvas resizes, or columns/gap/padding
// change; on unlock the pre-lock width is restored.
import type { BoardStore, BoundingBox, PluginContext, Viewport } from "@edv4h/usketch-shared";
import { clampViewportToBounds } from "@edv4h/usketch-store";
import { getDashboardConfig, gridSpecFromConfig, viewportLockOf } from "./config-ops.js";
import { isDashboardConfig } from "./dashboard-config-shape.js";
import { repackBoardTransient, runGuarded } from "./dashboard-runtime.js";
import type { GridSpec } from "./grid.js";
import { allDashboardItems } from "./items.js";

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
	// The user's cell width before the lock auto-took it over, restored on unlock.
	let savedCellW: number | null = null;
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
		// 100% zoom, grid's left edge pinned to screen left (auto width fills the
		// screen so there's no horizontal room), vertical pan clamped to the content.
		const clamped = clampViewportToBounds(
			{ x: -spec.originX, y: vp.y, zoom: 1 },
			contentBounds(ctx.store, spec),
			size,
		);
		return { x: -spec.originX, y: clamped.y, zoom: 1 };
	};

	ctx.store.setViewportConstraint(constrain);

	/** Set the cell width so the grid fills the screen, then repack — transiently
	 *  (no undo entry, ignored by the reflow runtime). */
	function applyAutoWidth(): void {
		const config = getDashboardConfig(ctx.store);
		const size = canvasSize();
		if (!config || !size) return;
		const autoW = autoCellWidth(gridSpecFromConfig(config), size.width);
		if (autoW === null || Math.abs(config.cellW - autoW) < 0.5) return;
		applyingAuto = true;
		try {
			runGuarded(() =>
				ctx.store.updateShape(config.id, { cellW: autoW } as Partial<typeof config>),
			);
			repackBoardTransient(ctx);
		} finally {
			applyingAuto = false;
		}
	}

	/** Restore the user's pre-lock cell width and repack (transient). */
	function restoreWidth(width: number): void {
		const config = getDashboardConfig(ctx.store);
		if (!config || Math.abs(config.cellW - width) < 0.5) return;
		applyingAuto = true;
		try {
			runGuarded(() =>
				ctx.store.updateShape(config.id, { cellW: width } as Partial<typeof config>),
			);
			repackBoardTransient(ctx);
		} finally {
			applyingAuto = false;
		}
	}

	// Re-commit (and re-fit the auto width) when the lock toggles, the config
	// (columns / gap / padding) changes, or the canvas resizes.
	const reapply = () => {
		const config = getDashboardConfig(ctx.store);
		if (viewportLockOf(ctx.store)) {
			if (config && savedCellW === null) savedCellW = config.cellW; // entering lock
			applyAutoWidth();
		} else if (savedCellW !== null) {
			restoreWidth(savedCellW); // leaving lock
			savedCellW = null;
		}
		ctx.store.setViewport(ctx.store.getViewport());
	};

	const offMutation = ctx.store.onMutation((event) => {
		if (applyingAuto) return; // ignore our own auto-width write
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
