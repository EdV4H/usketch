import { animatedLogoPlugin } from "./animated-logo";
import { chartHybridPlugin } from "./chart-hybrid";
import { colorPickerPlugin } from "./color-picker";

export type { HeartShape } from "./heart";

import { heartPlugin } from "./heart";
import { htmlCounterPlugin } from "./html-counter";

export type { StarShape } from "./star";

import { starPlugin } from "./star";

export type { TriangleShape } from "./triangle";

import { trianglePlugin } from "./triangle";
import { videoPlayerPlugin } from "./video-player";

export { heartPlugin, starPlugin, trianglePlugin };

// All custom shape plugins - direct imports since lazy loading isn't necessary
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
