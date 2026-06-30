export {
	type FreedrawConfig,
	type FreedrawConfigInput,
	FreedrawConfigSchema,
	parseFreedrawConfig,
} from "./config.js";
export { DEFAULT_PEN, PEN_KINDS, PEN_META, PRESET_COLORS } from "./pen-meta.js";
export { createFreedrawPlugin } from "./plugin.js";
export type { FreedrawShapeData, PenKind, StrokePoint } from "./types.js";
