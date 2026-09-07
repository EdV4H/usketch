// Read/write helpers for the `dashboard-config` singleton. Kept separate from the
// shape definition so the runtime, service, and HUD all go through one place to
// locate + mutate config, and none of them re-derive the "find the singleton"
// scan.
import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import {
	type DashboardConfigData,
	type DashboardDefaults,
	type DashboardMode,
	isDashboardConfig,
	makeDashboardConfig,
	type ViewportLock,
} from "./dashboard-config-shape.js";
import type { GridSpec } from "./grid.js";

/** Grid settings a caller may change (identity/geometry-only subset of config). */
export type DashboardConfigPatch = Partial<
	Pick<
		DashboardConfigData,
		| "columns"
		| "cellW"
		| "cellH"
		| "gap"
		| "padding"
		| "originX"
		| "originY"
		| "mode"
		| "fitToGrid"
		| "freeOutOfRange"
		| "viewportLock"
		| "cellWAuto"
		| "swap"
		| "swapThreshold"
		| "swapDelay"
	>
>;

/** The board's placement mode (defaults to `flow` when not a dashboard/unset). */
export function modeOf(store: BoardStore): DashboardMode {
	return getDashboardConfig(store)?.mode ?? "flow";
}

/** Whether resizing snaps items to whole-cell sizes (defaults to `false`). */
export function fitToGridOf(store: BoardStore): boolean {
	return getDashboardConfig(store)?.fitToGrid ?? false;
}

/** Whether out-of-range shapes are left free (defaults to `true`). */
export function freeOutOfRangeOf(store: BoardStore): boolean {
	return getDashboardConfig(store)?.freeOutOfRange ?? true;
}

/** Whether the scroll-limit is on (defaults to off). Strict `=== true` so a config
 *  persisted with the old `"off"|"vertical"|"both"` string coerces to OFF. */
export function viewportLockOf(store: BoardStore): ViewportLock {
	return getDashboardConfig(store)?.viewportLock === true;
}

/** Whether the cell width is "auto" (fit to screen) rather than a fixed number. */
export function cellWAutoOf(store: BoardStore): boolean {
	return getDashboardConfig(store)?.cellWAuto === true;
}

/** Whether drop-onto-occupied swaps the two items (absolute mode). Defaults off. */
export function swapOf(store: BoardStore): boolean {
	return getDashboardConfig(store)?.swap === true;
}

/** Minimum overlap ratio (0–1) for a swap to fire (absolute mode). Defaults 0.25. */
export function swapThresholdOf(store: BoardStore): number {
	const t = getDashboardConfig(store)?.swapThreshold;
	return typeof t === "number" && Number.isFinite(t) ? Math.min(Math.max(t, 0), 1) : 0.25;
}

/** Dwell (ms) before the live avoid fires. Defaults 200 when unset; an explicit 0
 *  (immediate) is honored. */
export function swapDelayOf(store: BoardStore): number {
	const d = getDashboardConfig(store)?.swapDelay;
	return typeof d === "number" && Number.isFinite(d) && d >= 0 ? d : 200;
}

/**
 * The board's config singleton, or `undefined` if this board isn't a dashboard.
 * If two clients happen to `enable()` at the same time, the board can briefly
 * hold more than one config; pick the one with the smallest `id` so every client
 * converges on the SAME config (rather than depending on Map insertion order,
 * which can differ per client) — the grid then can't diverge across peers.
 */
export function getDashboardConfig(store: BoardStore): DashboardConfigData | undefined {
	let chosen: DashboardConfigData | undefined;
	for (const [, shape] of store.getShapes()) {
		if (isDashboardConfig(shape) && (chosen === undefined || shape.id < chosen.id)) {
			chosen = shape;
		}
	}
	return chosen;
}

/**
 * Return the board's config singleton, creating it first if absent. Creating it
 * is what turns a plain board INTO a dashboard (requirement: the applied Canvas
 * becomes dashboard-only). Call after the store has hydrated so a synced config
 * isn't duplicated.
 */
export function ensureDashboardConfig(
	store: BoardStore,
	defaults: DashboardDefaults = {},
): DashboardConfigData {
	const existing = getDashboardConfig(store);
	if (existing) return existing;
	const config = makeDashboardConfig(defaults);
	store.addShape(config);
	return config;
}

/** Every `dashboard-config` shape on the board. Normally 0 or 1, but a concurrent
 *  `enable()` across clients can briefly leave more than one — {@link disable}
 *  removes them all so the board reliably becomes a non-dashboard again. */
export function getAllDashboardConfigs(store: BoardStore): DashboardConfigData[] {
	const configs: DashboardConfigData[] = [];
	for (const [, shape] of store.getShapes()) {
		if (isDashboardConfig(shape)) configs.push(shape);
	}
	return configs;
}

/** Project the config singleton onto the pure {@link GridSpec} the grid math uses. */
export function gridSpecFromConfig(config: DashboardConfigData): GridSpec {
	return {
		columns: config.columns,
		cellW: config.cellW,
		cellH: config.cellH,
		gap: config.gap,
		padding: config.padding,
		originX: config.originX,
		originY: config.originY,
	};
}

/** Direct (non-undoable) config write. The service wraps this in a command when
 *  the change should be undoable; programmatic callers can use it as-is. */
export function setConfig(store: BoardStore, patch: DashboardConfigPatch): void {
	const config = getDashboardConfig(store);
	if (!config) return;
	// Config carries custom fields on top of ShapeData; the store merges them
	// verbatim (same pattern as the map plugin's shape-field writes).
	store.updateShape(config.id, patch as Partial<ShapeData>);
}
