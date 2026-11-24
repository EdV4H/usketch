export type {
	PagePluginChoice,
	PagePluginsOptions,
	PagePresetChoice,
} from "./page-plugins.js";
export { conflictingPlugins, togglePlugin } from "./page-plugins.js";
export {
	collectTransferShapes,
	copyShapesToPage,
	MOVED_OUT_MAP_KEY,
	moveShapesToPage,
	removeMovedOutShapes,
	watchMovedOutShapes,
} from "./page-transfer.js";
export type { PagesApi, PagesApiDeps, PageView } from "./pages-api.js";
export { createPagesApi } from "./pages-api.js";
export type { OpenPageDoc } from "./pages-ops.js";
export {
	copyName,
	copyPageContent,
	duplicatePage,
	neighborPage,
	nextPageName,
} from "./pages-ops.js";
export { PagesPanel } from "./pages-panel.js";
export { getPagesApi, pagesService } from "./pages-service.js";
export type { PagesPluginOptions } from "./plugin.js";
export { createPagesPlugin, PAGES_PLUGIN_ID } from "./plugin.js";
