export {
	createWindowSystemPlugin,
	type WindowSystemPluginOptions,
} from "./plugin.js";
export type {
	WindowActionKey,
	WindowShortcuts,
} from "./register-window-actions.js";
export {
	buildDefaultTree,
	type FocusDir,
	layoutTree,
	type Placement,
	type Rect,
	type SplitDir,
	type TileNode,
} from "./tile-tree.js";
export {
	WINDOW_CONFIG_TYPE,
	type WindowConfigData,
	type WindowDefaults,
	type WindowMode,
} from "./window-config-shape.js";
export {
	getWindowSystemApi,
	type WindowSystemApi,
	windowSystemService,
} from "./window-service.js";
