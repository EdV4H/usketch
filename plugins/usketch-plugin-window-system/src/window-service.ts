// The window system's host-facing API on the `ctx.services` seam (same convention
// as dashboard's `dashboard-service` / map's `map-service`): operation logic lives
// in plain methods, the HUD / actions / event handlers all call them, and the same
// methods are bundled into a typed service so a host — or another plugin — can
// drive the window system without the HUD.
import { defineService, type PluginContext, type ServiceRegistry } from "@edv4h/usketch-shared";
import {
	defaultSplitOf,
	ensureWindowConfig,
	focusedIdOf,
	fullscreenIdOf,
	gapOf,
	getAllWindowConfigs,
	getTree,
	getWindowConfig,
	modeOf,
	setConfig,
	viewportLockOf,
} from "./config-ops.js";
import { windowIds } from "./items.js";
import {
	type FocusDir,
	layoutTree,
	neighbor,
	reconcile,
	resize as resizeTree,
	type SplitDir,
	setDir,
	swapLeaves,
} from "./tile-tree.js";
import { isWindowConfig, type WindowDefaults, type WindowMode } from "./window-config-shape.js";
import {
	applyTile,
	applyTileTransient,
	applyTileWithTree,
	runGuarded,
	screenRect,
} from "./window-runtime.js";

/** How much one resize step grows/shrinks the focused window's fraction. */
const RESIZE_STEP = 0.05;

/** The window system's host-facing operations. */
export interface WindowSystemApi {
	/** True when this board is a window board (its config singleton exists). */
	isWindowBoard(): boolean;
	/** Turn this board INTO a window board: create the config singleton if absent,
	 *  then tile the existing top-level shapes (when in tile mode). */
	enable(): void;
	/** Turn the window system OFF (remove the config singleton). Window positions are
	 *  left where they are; only the tiling/lock behaviour stops. */
	disable(): void;
	/** Placement mode: `free` (floating) or `tile` (i3/sway tree). */
	getMode(): WindowMode;
	/** Switch placement mode. free→tile builds a default tree when none exists and
	 *  tiles; tile→free leaves windows where they are (now free-draggable). */
	setMode(mode: WindowMode): void;
	/** Toggle between free and tile. */
	toggleMode(): void;
	/** Whether the fixed-screen viewport lock is on. */
	getLock(): boolean;
	/** Turn the fixed-screen lock on/off (orthogonal to mode). */
	setLock(lock: boolean): void;
	/** Toggle the fixed-screen lock. */
	toggleLock(): void;
	/** Inter-window gap (world px). */
	getGap(): number;
	/** Set the inter-window gap (clamped ≥ 0; re-tiles). */
	setGap(gap: number): void;
	/** Orientation new windows split with. */
	getDefaultSplit(): SplitDir;
	/** Set the default split orientation. */
	setDefaultSplit(dir: SplitDir): void;
	/** Re-tile every window to the tree (one undoable command). */
	retile(): void;
	/** Move focus to the geometrically adjacent window (selection follows). */
	focus(dir: FocusDir): void;
	/** Swap the focused window with its geometric neighbor (undoable). */
	move(dir: FocusDir): void;
	/** Grow (`+1`) or shrink (`-1`) the focused window along its parent split. */
	resize(step: 1 | -1): void;
	/** Re-split the focused window's row horizontally, and default new splits to h. */
	splitH(): void;
	/** Re-split the focused window's column vertically, and default new splits to v. */
	splitV(): void;
	/** Toggle the focused window filling the whole fixed screen. */
	toggleFullscreen(): void;
	/** The focused window id, or null. */
	getFocused(): string | null;
	/** Fire `listener` whenever the config changes (config edit / enable / disable). */
	onChange(listener: () => void): () => void;
}

/** Typed service handle. Provide in `setup`, get via {@link getWindowSystemApi}. */
export const windowSystemService = defineService<WindowSystemApi>("usketch-plugin-window-system");

/** Write config fields (guarded so the viewport-lock listener ignores it), then
 *  re-tile transiently. Used for preference-style changes (mode/lock/gap/split). */
function setConfigAndTile(ctx: PluginContext, patch: Parameters<typeof setConfig>[1]): void {
	runGuarded(() => setConfig(ctx.store, patch));
	applyTileTransient(ctx);
}

/** The current tree reconciled with the board's actual windows, anchored on focus. */
function currentTree(ctx: PluginContext) {
	return reconcile(
		getTree(ctx.store),
		windowIds(ctx.store),
		focusedIdOf(ctx.store),
		defaultSplitOf(ctx.store),
	);
}

/** Build the window API bound to a plugin context (called in `setup`). */
export function createWindowApi(
	ctx: PluginContext,
	defaults: WindowDefaults = {},
): WindowSystemApi {
	const focusedOr = (): string | null => {
		const f = focusedIdOf(ctx.store);
		if (f && windowIds(ctx.store).includes(f)) return f;
		return windowIds(ctx.store)[0] ?? null;
	};

	return {
		isWindowBoard: () => getWindowConfig(ctx.store) !== undefined,
		enable: () => {
			ensureWindowConfig(ctx.store, defaults);
			applyTile(ctx);
		},
		disable: () => {
			for (const config of getAllWindowConfigs(ctx.store)) ctx.store.deleteShape(config.id);
		},
		getMode: () => modeOf(ctx.store),
		setMode: (mode) => {
			if (mode !== "free" && mode !== "tile") return;
			if (mode === modeOf(ctx.store)) return;
			setConfigAndTile(ctx, { mode, fullscreenId: null });
		},
		toggleMode: () => {
			setConfigAndTile(ctx, {
				mode: modeOf(ctx.store) === "tile" ? "free" : "tile",
				fullscreenId: null,
			});
		},
		getLock: () => viewportLockOf(ctx.store),
		setLock: (lock) => {
			runGuarded(() => setConfig(ctx.store, { viewportLock: lock === true }));
			applyTileTransient(ctx);
			ctx.store.setViewport(ctx.store.getViewport()); // re-commit → re-pin/unpin
		},
		toggleLock: () => {
			runGuarded(() => setConfig(ctx.store, { viewportLock: !viewportLockOf(ctx.store) }));
			applyTileTransient(ctx);
			ctx.store.setViewport(ctx.store.getViewport());
		},
		getGap: () => gapOf(ctx.store),
		setGap: (gap) => {
			if (!Number.isFinite(gap)) return;
			setConfigAndTile(ctx, { gap: Math.max(0, gap) });
		},
		getDefaultSplit: () => defaultSplitOf(ctx.store),
		setDefaultSplit: (dir) => {
			if (dir !== "h" && dir !== "v") return;
			runGuarded(() => setConfig(ctx.store, { defaultSplit: dir }));
		},
		retile: () => applyTile(ctx),
		focus: (dir) => {
			if (modeOf(ctx.store) !== "tile") return;
			const focus = focusedOr();
			if (!focus) return;
			const rect = screenRect(ctx.store);
			if (!rect) return;
			const placements = layoutTree(currentTree(ctx), rect, gapOf(ctx.store));
			const next = neighbor(placements, focus, dir);
			if (!next) return;
			runGuarded(() => setConfig(ctx.store, { focusedId: next }));
			ctx.store.setSelection([next]);
		},
		move: (dir) => {
			if (modeOf(ctx.store) !== "tile") return;
			const focus = focusedOr();
			if (!focus) return;
			const rect = screenRect(ctx.store);
			if (!rect) return;
			const tree = currentTree(ctx);
			const placements = layoutTree(tree, rect, gapOf(ctx.store));
			const target = neighbor(placements, focus, dir);
			if (!target) return;
			applyTileWithTree(ctx, swapLeaves(tree, focus, target));
		},
		resize: (step) => {
			if (modeOf(ctx.store) !== "tile") return;
			const focus = focusedOr();
			if (!focus) return;
			applyTileWithTree(ctx, resizeTree(currentTree(ctx), focus, step * RESIZE_STEP));
		},
		splitH: () => splitFocus(ctx, "h", focusedOr()),
		splitV: () => splitFocus(ctx, "v", focusedOr()),
		toggleFullscreen: () => {
			if (modeOf(ctx.store) !== "tile") return;
			const focus = focusedOr();
			if (!focus) return;
			const next = fullscreenIdOf(ctx.store) === focus ? null : focus;
			setConfigAndTile(ctx, { fullscreenId: next });
		},
		getFocused: () => focusedIdOf(ctx.store),
		onChange: (listener) => {
			let wasBoard = getWindowConfig(ctx.store) !== undefined;
			return ctx.store.onMutation((e) => {
				if (e.type === "shape:updated") {
					if (isWindowConfig(e.payload.after)) listener();
					return;
				}
				if (e.type === "shape:added" || e.type === "shape:removed") {
					const isBoard = getWindowConfig(ctx.store) !== undefined;
					if (isBoard !== wasBoard) {
						wasBoard = isBoard;
						listener();
					}
				}
			});
		},
	};
}

/** Re-split the focused window's parent and set the default for future inserts. */
function splitFocus(ctx: PluginContext, dir: SplitDir, focus: string | null): void {
	runGuarded(() => setConfig(ctx.store, { defaultSplit: dir }));
	if (modeOf(ctx.store) !== "tile" || !focus) return;
	applyTileWithTree(ctx, setDir(currentTree(ctx), focus, dir));
}

/**
 * Host accessor: `getWindowSystemApi(app.services)?.retile()`. Returns `undefined`
 * when the plugin isn't active. Works with `ctx.services` too.
 */
export function getWindowSystemApi(services: ServiceRegistry): WindowSystemApi | undefined {
	return windowSystemService.get(services);
}
