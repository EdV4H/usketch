export { DEFAULT_SHAPE_MAP, parseVimConfig } from "./config/default-config.js";
export {
	type ShapeSpec,
	type VimConfig,
	type VimConfigInput,
	VimConfigSchema,
} from "./config/schema.js";
export type {
	VimApi,
	VimBindingHandler,
	VimCommandHandler,
	VimExtensions,
} from "./extensions.js";
export type { VimMode } from "./machine/types.js";
export { createVimToolPlugin } from "./plugin.js";
