// Dashboard plugin: applying it turns the whole Canvas into a sortable flow-grid.
// Top-level shapes become grid items that snap to cells and reflow live when you
// drag one to reorder. It registers only a DATA-ONLY config singleton (no user
// widget shape), provides a host-facing service, contributes HUD controls, and
// runs the reorder runtime. Register it AFTER the container / free-position
// plugins so its during-drag reflow is the last writer on top-level moves.
import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import { ensureDashboardConfig } from "./config-ops.js";
import { DASHBOARD_CONFIG_TYPE, type DashboardDefaults } from "./dashboard-config-shape.js";
import { createDashboardConfigShapeDefinition } from "./dashboard-config-shape-def.js";
import { repackBoard, setupDashboard } from "./dashboard-runtime.js";
import { createDashboardApi, dashboardService } from "./dashboard-service.js";
import { registerDashboardHud } from "./register-dashboard-hud.js";

export interface DashboardPluginOptions extends DashboardDefaults {
	/**
	 * Create the config singleton on setup so the board becomes a dashboard
	 * immediately (default `true`). Set `false` to leave activation to a host
	 * calling the service / creating the config itself.
	 */
	autoCreate?: boolean;
}

export function createDashboardPlugin(options: DashboardPluginOptions = {}): UsketchPlugin {
	const { autoCreate = true, ...defaults } = options;
	return {
		id: "usketch-plugin-dashboard",
		name: "ダッシュボード",
		setup(ctx: PluginContext) {
			ctx.shapes.register(DASHBOARD_CONFIG_TYPE, createDashboardConfigShapeDefinition(defaults));

			const api = createDashboardApi(ctx, defaults);

			// Disposed guard: the autoCreate task WRITES to the store, and a microtask
			// can't be cancelled — without this it could run after teardown (an
			// immediate `app.destroy()`, or setup-rollback) and mutate a destroyed
			// app's store. Checked inside the deferred task.
			let disposed = false;

			// Defer to a microtask so shapes hydrated synchronously on load (incl. a
			// synced config from another client) are visible first — `ensure` is a
			// no-op when a config already exists, avoiding a duplicate singleton.
			// Then pack the existing top-level shapes so the board is actually laid
			// out on the grid (creating the config alone doesn't move anything, and
			// the config's own `shape:added` isn't an item so it won't trigger a
			// repack).
			if (autoCreate) {
				queueMicrotask(() => {
					if (disposed) return;
					ensureDashboardConfig(ctx.store, defaults);
					repackBoard(ctx);
				});
			}

			const stopRuntime = setupDashboard(ctx);
			const stopHud = registerDashboardHud(ctx, api);
			// Provide the service LAST: `createApp` can only roll back a failed setup
			// via the teardown we return, so if an earlier step throws the service was
			// never registered and can't leak. (Same ordering as usketch-plugin-map.)
			const unprovideService = dashboardService.provide(ctx.services, api);

			return () => {
				disposed = true;
				unprovideService();
				stopHud();
				stopRuntime();
			};
		},
	};
}
