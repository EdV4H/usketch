export {
	type DashboardConfigPatch,
	ensureDashboardConfig,
	fitToGridOf,
	getDashboardConfig,
	gridSpecFromConfig,
	modeOf,
	setConfig,
} from "./config-ops.js";
export {
	DASHBOARD_CONFIG_TYPE,
	DASHBOARD_DEFAULTS,
	type DashboardConfigData,
	type DashboardDefaults,
	type DashboardMode,
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
	cellOfPoint,
	cellTopLeft,
	cellXY,
	fitSize,
	type GridSpec,
	type ItemSize,
	type PlacedBox,
	type Placement,
	packAbsolute,
	packSpans,
	type Span,
	spanOf,
	targetIndexFromPoint,
} from "./grid.js";
export {
	GRID_OVERLAY_LAYER_ID,
	gridOverlayLayer,
	isGridOverlayVisible,
	setGridOverlayVisible,
} from "./grid-overlay.js";
export { dashboardItems, isDashboardItem } from "./items.js";
export { readingOrder } from "./order.js";
export { createDashboardPlugin, type DashboardPluginOptions } from "./plugin.js";
export { registerDashboardHud } from "./register-dashboard-hud.js";
