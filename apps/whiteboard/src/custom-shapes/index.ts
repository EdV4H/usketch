// Export all custom shape plugins
export { animatedLogoPlugin } from "./animated-logo";
export { chartHybridPlugin } from "./chart-hybrid";
export { colorPickerPlugin } from "./color-picker";
export { heartPlugin } from "./heart";
export { htmlCounterPlugin } from "./html-counter";
export { starPlugin } from "./star";
export { trianglePlugin } from "./triangle";
export { videoPlayerPlugin } from "./video-player";

// Export plugin array for easy registration
import { animatedLogoPlugin } from "./animated-logo";
import { chartHybridPlugin } from "./chart-hybrid";
import { colorPickerPlugin } from "./color-picker";
import { heartPlugin } from "./heart";
import { htmlCounterPlugin } from "./html-counter";
import { starPlugin } from "./star";
import { trianglePlugin } from "./triangle";
import { videoPlayerPlugin } from "./video-player";

export const customShapePlugins = [
	heartPlugin,
	starPlugin,
	trianglePlugin,
	htmlCounterPlugin,
	animatedLogoPlugin,
	chartHybridPlugin,
	colorPickerPlugin,
	videoPlayerPlugin,
];
