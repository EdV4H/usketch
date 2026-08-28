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
	getAllDashboardConfigs,
	getDashboardConfig,
	gridSpecFromConfig,
} from "./config-ops.js";
import { type DashboardDefaults, isDashboardConfig } from "./dashboard-config-shape.js";
import { repackBoard } from "./dashboard-runtime.js";
import type { GridSpec } from "./grid.js";
import { packGrid } from "./grid.js";
import { dashboardItems } from "./items.js";
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
		before[key] = config[key];
	}

	const oldSpec = gridSpecFromConfig(config);
	const newSpec = gridSpecFromConfig({ ...config, ...patch });
	const order = readingOrder(dashboardItems(ctx.store), oldSpec);
	const placements = packGrid(order, newSpec);
	const moves = placements
		.map((p) => {
			const cur = ctx.store.getShape(p.id);
			return cur ? { id: p.id, from: { x: cur.x, y: cur.y }, to: { x: p.x, y: p.y } } : null;
		})
		.filter((m): m is NonNullable<typeof m> => m !== null);

	const command: Command = {
		execute() {
			ctx.store.updateShape(config.id, patch as Partial<ShapeData>);
			for (const m of moves) ctx.store.updateShape(m.id, m.to);
		},
		undo() {
			ctx.store.updateShape(config.id, before as Partial<ShapeData>);
			for (const m of moves) ctx.store.updateShape(m.id, m.from);
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
			ensureDashboardConfig(ctx.store, defaults);
			repackBoard(ctx);
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
		repack: () => repackBoard(ctx),
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
