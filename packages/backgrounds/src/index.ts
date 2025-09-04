// 型定義

// プリセット
export { Backgrounds } from "./presets";

// レンダラー実装
export { BaseRenderer } from "./renderers/base";
export type { GradientConfig, PulseConfig } from "./renderers/custom-example";
// カスタムレンダラーの例
export { GradientRenderer, PulseRenderer } from "./renderers/custom-example";
export { DotsRenderer } from "./renderers/dots";
export { GridRenderer } from "./renderers/grid";
export { IsometricRenderer } from "./renderers/isometric";
export { LinesRenderer } from "./renderers/lines";
export { NoneRenderer } from "./renderers/none";
export type {
	BackgroundOptions,
	BackgroundRenderer,
	DotsConfig,
	GridConfig,
	IsometricConfig,
	LinesConfig,
} from "./types";
