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
import { setupDashboard } from "./dashboard-runtime.js";
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
			const unprovideService = dashboardService.provide(ctx.services, api);

			// Defer to a microtask so shapes hydrated synchronously on load (incl. a
			// synced config from another client) are visible first — `ensure` is a
			// no-op when a config already exists, avoiding a duplicate singleton.
			if (autoCreate) {
				queueMicrotask(() => ensureDashboardConfig(ctx.store, defaults));
			}

			const stopRuntime = setupDashboard(ctx);
			const stopHud = registerDashboardHud(ctx, api);

			return () => {
				stopHud();
				stopRuntime();
				unprovideService();
			};
		},
	};
}
