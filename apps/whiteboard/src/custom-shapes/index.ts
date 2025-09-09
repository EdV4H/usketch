export type { HeartShape } from "./heart";
export { heartPlugin } from "./heart";
export type { StarShape } from "./star";
export { starPlugin } from "./star";
export type { TriangleShape } from "./triangle";
export { trianglePlugin } from "./triangle";

// All custom shape plugins - direct imports since lazy loading isn't necessary
import { animatedLogoPlugin } from "./animated-logo";
import { chartHybridPlugin } from "./chart-hybrid";
import { colorPickerPlugin } from "./color-picker";
import { htmlCounterPlugin } from "./html-counter";
import { videoPlayerPlugin } from "./video-player";

export const customShapePlugins = [
	starPlugin,
	heartPlugin,
	trianglePlugin,
	// New unified shapes demonstrating the abstraction layer
	htmlCounterPlugin,
	colorPickerPlugin,
	chartHybridPlugin,
	videoPlayerPlugin,
	animatedLogoPlugin,
];
