// The dashboard's host-facing API on the `ctx.services` seam (same convention as
// the map plugin's `map-service.ts`): operation logic lives in plain functions,
// the HUD/actions call them, and the same functions are bundled into a typed
// service so a host — or any other plugin — can drive the dashboard without the
// HUD and without importing individual helpers.
import {
	type Command,
	defineService,
	type PluginContext,
	type ServiceRegistry,
	type ShapeData,
} from "@edv4h/usketch-shared";
import {
	type DashboardConfigPatch,
	ensureDashboardConfig,
	fitToGridOf,
	freeOutOfRangeOf,
	getAllDashboardConfigs,
	getDashboardConfig,
	gridSpecFromConfig,
	modeOf,
	setConfig,
	viewportLockOf,
} from "./config-ops.js";
import {
	type DashboardDefaults,
	type DashboardMode,
	isDashboardConfig,
	type ViewportLock,
} from "./dashboard-config-shape.js";
import { repackBoard, runGuarded } from "./dashboard-runtime.js";
import type { GridSpec } from "./grid.js";
import { fitSize, packAbsolute, packSpans } from "./grid.js";
import { allDashboardItems, dashboardItems } from "./items.js";
import { readingOrder } from "./order.js";

/** The dashboard's host-facing operations. */
export interface DashboardApi {
	/** True when this board is a dashboard (its config singleton exists). */
	isDashboardBoard(): boolean;
	/** Turn this board INTO a dashboard: create the config singleton if absent
	 *  (never duplicated), then pack the existing top-level shapes into the grid.
	 *  Re-packs on every call — so it doubles as a re-arrange and is NOT a no-op
	 *  when already a dashboard. Use {@link repack} if you only want the re-pack. */
	enable(): void;
	/** Turn the dashboard OFF (remove the config singleton). Item positions are
	 *  left where they are — only the grid behaviour stops. */
	disable(): void;
	/** The board's live grid spec, or `null` when it isn't a dashboard. */
	getGridSpec(): GridSpec | null;
	/** The placement mode: `flow` (compact/sortable) or `absolute` (drop-in-place). */
	getMode(): DashboardMode;
	/** Switch placement mode (undoable; re-lays out under the new mode). */
	setMode(mode: DashboardMode): void;
	/** Whether resizing snaps items to whole-cell sizes. */
	getFitToGrid(): boolean;
	/** Toggle "fit to grid". Turning it ON also snaps every existing item's size to
	 *  the grid and re-lays out — one undoable command. */
	setFitToGrid(on: boolean): void;
	/** Whether shapes dragged out of the grid range are left free (vs. all managed). */
	getFreeOutOfRange(): boolean;
	/** Toggle it. Turning it OFF gathers every shape back into the grid. */
	setFreeOutOfRange(on: boolean): void;
	/** The viewport constraint mode. */
	getViewportLock(): ViewportLock;
	/** Set the viewport constraint (`off` / `vertical` / `both`). */
	setViewportLock(lock: ViewportLock): void;
	/** Re-snap every item to its reading-order cell (one undoable command). */
	repack(): void;
	/** Set the column count (undoable; relayouts items). */
	setColumns(columns: number): void;
	/** Set the cell size (undoable; relayouts items). */
	setCellSize(cellW: number, cellH: number): void;
	/** Set the inter-cell gap (undoable; relayouts items). */
	setGap(gap: number): void;
	/** Set the grid padding (undoable; relayouts items). */
	setPadding(padding: number): void;
	/** Fire `listener` whenever the config changes. Returns an unsubscribe. */
	onChange(listener: () => void): () => void;
}

/** Typed service handle for the dashboard API. Provide in `setup`, get via {@link getDashboardApi}. */
export const dashboardService = defineService<DashboardApi>("usketch-plugin-dashboard");

/**
 * Apply a config change AND relayout in ONE undoable command: changing columns or
 * cell size moves every item, so config + positions revert together on undo.
 * Order is read from the OLD geometry, then re-packed under the NEW spec.
 */
function applyConfig(ctx: PluginContext, patch: DashboardConfigPatch): void {
	const config = getDashboardConfig(ctx.store);
	if (!config) return;

	const before: DashboardConfigPatch = {};
	for (const key of Object.keys(patch) as (keyof DashboardConfigPatch)[]) {
		Object.assign(before, { [key]: config[key] });
	}

	const oldSpec = gridSpecFromConfig(config);
	const newSpec = gridSpecFromConfig({ ...config, ...patch });
	const newMode = patch.mode ?? config.mode;
	const newFit = patch.fitToGrid ?? config.fitToGrid;
	const items = readingOrder(dashboardItems(ctx.store), oldSpec)
		.map((id) => ctx.store.getShape(id))
		.filter((s): s is ShapeData => s !== undefined);

	// New sizes: when "fit to grid" is on, snap every item to the NEW cell size so a
	// cell-size / gap / column change resizes items immediately (not just repacks).
	const sized = items.map((s) => {
		const size = newFit
			? fitSize(s.width, s.height, newSpec)
			: { width: s.width, height: s.height };
		return {
			id: s.id,
			x: s.x,
			y: s.y,
			w: size.width,
			h: size.height,
			oldW: s.width,
			oldH: s.height,
		};
	});
	// Re-lay out under the NEW spec+mode with the new sizes: flow compacts in reading
	// order; absolute snaps each to the cell nearest its current position.
	const placements =
		newMode === "absolute"
			? packAbsolute(
					sized.map((b) => ({ id: b.id, x: b.x, y: b.y, width: b.w, height: b.h })),
					newSpec,
				)
			: packSpans(
					sized.map((b) => ({ id: b.id, width: b.w, height: b.h })),
					newSpec,
				);
	const posById = new Map(placements.map((p) => [p.id, p]));

	// Guard both directions so the item writes aren't mistaken for a user drag by
	// the reflow runtime (the config write itself isn't an item, so it's ignored).
	const command: Command = {
		execute() {
			runGuarded(() => {
				ctx.store.updateShape(config.id, patch as Partial<ShapeData>);
				for (const b of sized) {
					const p = posById.get(b.id);
					ctx.store.updateShape(b.id, {
						...(newFit ? { width: b.w, height: b.h } : {}),
						...(p ? { x: p.x, y: p.y } : {}),
					});
				}
			});
		},
		undo() {
			runGuarded(() => {
				ctx.store.updateShape(config.id, before as Partial<ShapeData>);
				for (const b of sized) {
					ctx.store.updateShape(b.id, {
						...(newFit ? { width: b.oldW, height: b.oldH } : {}),
						x: b.x,
						y: b.y,
					});
				}
			});
		},
	};
	ctx.commands.execute(command);
}

/**
 * Toggle "fit to grid" in ONE undoable command: set the flag, snap every item's
 * SIZE to the nearest whole-cell span (only when turning on), and re-lay out the
 * board with the new sizes.
 */
function applyFitToGrid(ctx: PluginContext, on: boolean): void {
	const config = getDashboardConfig(ctx.store);
	if (!config) return;
	const spec = gridSpecFromConfig(config);
	const items = dashboardItems(ctx.store);

	// New sizes (fit) when turning on; unchanged when off. Keep old for undo.
	const sized = items.map((s) => {
		const f = on ? fitSize(s.width, s.height, spec) : { width: s.width, height: s.height };
		return { id: s.id, x: s.x, y: s.y, w: f.width, h: f.height, oldW: s.width, oldH: s.height };
	});
	const byId = new Map(sized.map((b) => [b.id, b]));
	// Re-pack positions using the NEW sizes, in the current mode.
	const order = readingOrder(items, spec).filter((id) => byId.has(id));
	const placements =
		modeOf(ctx.store) === "absolute"
			? packAbsolute(
					order.map((id) => {
						const b = byId.get(id) as NonNullable<ReturnType<typeof byId.get>>;
						return { id, x: b.x, y: b.y, width: b.w, height: b.h };
					}),
					spec,
				)
			: packSpans(
					order.map((id) => {
						const b = byId.get(id) as NonNullable<ReturnType<typeof byId.get>>;
						return { id, width: b.w, height: b.h };
					}),
					spec,
				);
	const posById = new Map(placements.map((p) => [p.id, p]));

	const command: Command = {
		execute() {
			runGuarded(() => {
				ctx.store.updateShape(config.id, { fitToGrid: on } as Partial<ShapeData>);
				for (const b of sized) {
					const p = posById.get(b.id);
					ctx.store.updateShape(b.id, {
						width: b.w,
						height: b.h,
						...(p ? { x: p.x, y: p.y } : {}),
					});
				}
			});
		},
		undo() {
			runGuarded(() => {
				ctx.store.updateShape(config.id, { fitToGrid: config.fitToGrid } as Partial<ShapeData>);
				for (const b of sized) {
					ctx.store.updateShape(b.id, { width: b.oldW, height: b.oldH, x: b.x, y: b.y });
				}
			});
		},
	};
	ctx.commands.execute(command);
}

/** Build the dashboard API bound to a plugin context (called in `setup`). The
 *  `defaults` seed a config created via {@link DashboardApi.enable}. */
export function createDashboardApi(
	ctx: PluginContext,
	defaults: DashboardDefaults = {},
): DashboardApi {
	return {
		isDashboardBoard: () => getDashboardConfig(ctx.store) !== undefined,
		enable: () => {
			const alreadyDashboard = getDashboardConfig(ctx.store) !== undefined;
			const config = ensureDashboardConfig(ctx.store, defaults);
			// On the FIRST enable, anchor the grid at the current items' top-left so
			// arranging keeps them where the user is looking (rather than snapping to
			// world origin 0,0, which can be far off-screen and look like a no-op).
			// Don't re-seed on a later enable — that would drag the grid around.
			if (!alreadyDashboard) {
				const items = allDashboardItems(ctx.store);
				if (items.length > 0) {
					let minX = Number.POSITIVE_INFINITY;
					let minY = Number.POSITIVE_INFINITY;
					let minW = Number.POSITIVE_INFINITY;
					let minH = Number.POSITIVE_INFINITY;
					for (const s of items) {
						if (s.x < minX) minX = s.x;
						if (s.y < minY) minY = s.y;
						if (s.width < minW) minW = s.width;
						if (s.height < minH) minH = s.height;
					}
					// Seed the CELL to the smallest item (floored) so a mix of sizes
					// actually spans: the smallest item is 1×1 and bigger ones take
					// proportionally more cells. A fixed default cell that's larger than
					// every item would make everything 1×1 ("nothing spans").
					const CELL_FLOOR = 40;
					setConfig(ctx.store, {
						cellW: Math.max(CELL_FLOOR, Math.round(minW)),
						cellH: Math.max(CELL_FLOOR, Math.round(minH)),
						originX: minX - config.padding,
						originY: minY - config.padding,
					});
				}
			}
			repackBoard(ctx, true); // gather every shape into the grid on enable
		},
		disable: () => {
			// Remove EVERY config, not just the chosen one: a concurrent enable can
			// leave several, and deleting one would leave the board a dashboard.
			for (const config of getAllDashboardConfigs(ctx.store)) ctx.store.deleteShape(config.id);
		},
		getGridSpec: () => {
			const config = getDashboardConfig(ctx.store);
			return config ? gridSpecFromConfig(config) : null;
		},
		getMode: () => modeOf(ctx.store),
		setMode: (mode) => {
			if (mode === "flow" || mode === "absolute") applyConfig(ctx, { mode });
		},
		getFitToGrid: () => fitToGridOf(ctx.store),
		setFitToGrid: (on) => applyFitToGrid(ctx, on),
		getFreeOutOfRange: () => freeOutOfRangeOf(ctx.store),
		setFreeOutOfRange: (on) => {
			const config = getDashboardConfig(ctx.store);
			if (!config || config.freeOutOfRange === on) return;
			const command: Command = {
				execute: () =>
					runGuarded(() =>
						ctx.store.updateShape(config.id, { freeOutOfRange: on } as Partial<ShapeData>),
					),
				undo: () =>
					runGuarded(() =>
						ctx.store.updateShape(config.id, { freeOutOfRange: !on } as Partial<ShapeData>),
					),
			};
			ctx.commands.execute(command);
			if (!on) repackBoard(ctx, true); // range now unlimited → gather everything
		},
		getViewportLock: () => viewportLockOf(ctx.store),
		setViewportLock: (lock) => {
			if (lock === "off" || lock === "vertical" || lock === "both") {
				setConfig(ctx.store, { viewportLock: lock });
			}
		},
		repack: () => repackBoard(ctx, true),
		// Ignore non-finite inputs (NaN/±Infinity) so a bad host call can't persist
		// a broken value into the config — `Math.max(1, NaN)` is `NaN`, so the clamp
		// alone doesn't protect the grid math / undo. The HUD already filters, but
		// other callers reach these directly via `ctx.services`.
		setColumns: (columns) => {
			if (!Number.isFinite(columns)) return;
			applyConfig(ctx, { columns: Math.max(1, Math.floor(columns)) });
		},
		setCellSize: (cellW, cellH) => {
			if (!Number.isFinite(cellW) || !Number.isFinite(cellH)) return;
			applyConfig(ctx, { cellW: Math.max(1, cellW), cellH: Math.max(1, cellH) });
		},
		setGap: (gap) => {
			if (!Number.isFinite(gap)) return;
			applyConfig(ctx, { gap: Math.max(0, gap) });
		},
		setPadding: (padding) => {
			if (!Number.isFinite(padding)) return;
			applyConfig(ctx, { padding: Math.max(0, padding) });
		},
		onChange: (listener) => {
			// Fire on a config edit, and whenever the board's dashboard-status flips
			// (enable/disable) — so HUD controls appear/disappear. A plain scan on
			// add/remove is fine: it only runs on structural changes, not per-frame.
			let wasDashboard = getDashboardConfig(ctx.store) !== undefined;
			return ctx.store.onMutation((e) => {
				if (e.type === "shape:updated") {
					if (isDashboardConfig(e.payload.after)) listener();
					return;
				}
				if (e.type === "shape:added" || e.type === "shape:removed") {
					const isDashboard = getDashboardConfig(ctx.store) !== undefined;
					if (isDashboard !== wasDashboard) {
						wasDashboard = isDashboard;
						listener();
					}
				}
			});
		},
	};
}

/**
 * Host accessor: `getDashboardApi(app.services)?.repack()`. Returns `undefined`
 * when the dashboard plugin isn't active. Works with `ctx.services` too.
 */
export function getDashboardApi(services: ServiceRegistry): DashboardApi | undefined {
	return dashboardService.get(services);
}
