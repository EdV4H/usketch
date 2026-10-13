export const PLUGIN_NAME = "usketch-plugin-bg-liquid" as const;
export {
	collectObstacles,
	DISPLACER_META_KEY,
	DISPLACER_PADDING,
	type DisplacerMode,
	isLiquidDisplacer,
	setLiquidDisplacer,
	toggleLiquidDisplacer,
} from "./displacer.js";
export { renderLiquidExportBackground } from "./export-background.js";
export {
	chooseCellSize,
	LiquidField,
	type LiquidObstacle,
	type LiquidStepParams,
} from "./liquid-field.js";
export {
	createLiquidBgApi,
	LIQUID_BG_TYPE,
	type LiquidBgApi,
	liquidBgService,
} from "./liquid-service.js";
export { flowNoise, type Rgb, type ShadeParams, shadeLiquid } from "./liquid-shading.js";
export {
	createLiquidState,
	DEFAULT_LIQUID_SETTINGS,
	type LiquidSettings,
	type LiquidState,
	viscosityToRates,
} from "./liquid-state.js";
export { createLiquidBgPlugin, type LiquidBgPluginOptions } from "./plugin.js";
