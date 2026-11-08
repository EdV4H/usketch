export {
	type FreedrawConfig,
	type FreedrawConfigInput,
	FreedrawConfigSchema,
	parseFreedrawConfig,
} from "./config.js";
export type { FinalizedStroke, FreedrawPenDefinition, PenSizeRange } from "./custom-pens.js";
export {
	type FreedrawApi,
	type FreedrawCurrentSettings,
	type FreedrawPenInfo,
	freedrawService,
	getFreedrawApi,
	listPens,
} from "./freedraw-service.js";
export { penHalfWidth } from "./geometry/hit.js";
export { DEFAULT_PEN, PEN_KINDS, PEN_META, PRESET_COLORS } from "./pen-meta.js";
export { createFreedrawPlugin, type FreedrawPluginOptions } from "./plugin.js";
export type { FreedrawMode } from "./settings-store.js";
export type { FreedrawHitTestMode } from "./shape.js";
export type { FreedrawShapeData, PenId, PenKind, StrokePoint } from "./types.js";
