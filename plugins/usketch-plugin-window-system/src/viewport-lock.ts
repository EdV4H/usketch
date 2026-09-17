// Freeze the camera into a FIXED SCREEN when the config's `viewportLock` is on.
// Zoom is pinned to 100% and the pan is pinned so the config's world origin maps
// to the top-left of the canvas — so the Canvas behaves like a stationary window
// manager surface rather than an infinite pan/zoom board. The lock is orthogonal
// to placement mode: it can be on in `free` mode too (fixed screen, floating
// windows). On a canvas resize the fixed screen changes size, so we re-tile.
//
// It installs a `store.setViewportConstraint`, applied inside the store's single
// viewport-commit path — so EVERY pan/zoom is constrained AT COMMIT and the stored
// viewport can never violate it.
import type { PluginContext, Viewport } from "@edv4h/usketch-shared";
import { getWindowConfig, viewportLockOf } from "./config-ops.js";
import { isWindowConfig } from "./window-config-shape.js";
import { applyTileTransient, isGuarded } from "./window-runtime.js";

/** Wire the fixed-screen viewport constraint. Returns a teardown. */
export function setupViewportLock(ctx: PluginContext): () => void {
	// Pin the camera so world `(originX, originY)` sits at screen `(0, 0)` at 100%
	// zoom (screen = world·zoom + vp): vp.x = -originX, vp.y = -originY.
	const constrain = (vp: Viewport): Viewport => {
		if (!viewportLockOf(ctx.store)) return vp;
		const config = getWindowConfig(ctx.store);
		if (!config) return vp;
		return { x: -config.originX, y: -config.originY, zoom: 1 };
	};

	ctx.store.setViewportConstraint(constrain);

	// Re-tile to the new fixed-screen size and re-commit the viewport (re-pin) when
	// the lock/config toggles or the canvas resizes.
	const reapply = () => {
		applyTileTransient(ctx);
		ctx.store.setViewport(ctx.store.getViewport());
	};

	// Coalesce resize-driven reapplies to one per frame.
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
		// Skip our OWN writes (guarded) — only external edits / sync / resize should
		// re-pin + re-tile, else applyTile's own tree write would recurse here.
		if (isGuarded()) return;
		if (event.type === "shape:updated" && isWindowConfig(event.payload.after)) reapply();
	});

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
