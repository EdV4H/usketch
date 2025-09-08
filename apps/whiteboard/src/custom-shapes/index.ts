export type { HeartShape } from "./heart";
export { heartPlugin } from "./heart";
export type { StarShape } from "./star";
export { starPlugin } from "./star";
export type { TriangleShape } from "./triangle";
export { trianglePlugin } from "./triangle";

// All custom shape plugins as an array for easy registration
export const customShapePlugins = async () => {
	const { starPlugin } = await import("./star");
	const { heartPlugin } = await import("./heart");
	const { trianglePlugin } = await import("./triangle");

	// New unified abstraction layer shapes
	const { htmlCounterUnifiedPlugin } = await import("./html-counter-unified");
	const { colorPickerUnifiedPlugin } = await import("./color-picker-unified");
	const { chartHybridUnifiedPlugin } = await import("./chart-hybrid-unified");
	const { videoPlayerUnifiedPlugin } = await import("./video-player-unified");
	const { animatedLogoUnifiedPlugin } = await import("./animated-logo-unified");

	return [
		starPlugin,
		heartPlugin,
		trianglePlugin,
		// New unified shapes demonstrating the abstraction layer
		htmlCounterUnifiedPlugin,
		colorPickerUnifiedPlugin,
		chartHybridUnifiedPlugin,
		videoPlayerUnifiedPlugin,
		animatedLogoUnifiedPlugin,
	];
};
