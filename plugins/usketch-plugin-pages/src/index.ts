export type { PagesApi, PagesApiDeps } from "./pages-api.js";
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
