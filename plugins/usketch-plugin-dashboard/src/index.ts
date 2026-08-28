export {
	type DashboardConfigPatch,
	ensureDashboardConfig,
	getDashboardConfig,
	gridSpecFromConfig,
	setConfig,
} from "./config-ops.js";
export {
	DASHBOARD_CONFIG_TYPE,
	DASHBOARD_DEFAULTS,
	type DashboardConfigData,
	type DashboardDefaults,
	isDashboardConfig,
	makeDashboardConfig,
} from "./dashboard-config-shape.js";
export { createDashboardConfigShapeDefinition } from "./dashboard-config-shape-def.js";
export { repackBoard, setupDashboard } from "./dashboard-runtime.js";
export {
	createDashboardApi,
	type DashboardApi,
	dashboardService,
	getDashboardApi,
} from "./dashboard-service.js";
export {
	cellTopLeft,
	type GridSpec,
	indexFromPoint,
	type Placement,
	packGrid,
	packGridWithGap,
} from "./grid.js";
export { dashboardItems, isDashboardItem } from "./items.js";
export { readingOrder } from "./order.js";
export { createDashboardPlugin, type DashboardPluginOptions } from "./plugin.js";
export { registerDashboardHud } from "./register-dashboard-hud.js";
