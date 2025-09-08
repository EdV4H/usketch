export type { HeartShape } from "./heart";
export { heartPlugin } from "./heart";
export type { HtmlCounterShape } from "./html-counter";
export { htmlCounterPlugin } from "./html-counter";
export type { StarShape } from "./star";
export { starPlugin } from "./star";
export type { TriangleShape } from "./triangle";
export { trianglePlugin } from "./triangle";

// All custom shape plugins as an array for easy registration
export const customShapePlugins = async () => {
	const { starPlugin } = await import("./star");
	const { heartPlugin } = await import("./heart");
	const { trianglePlugin } = await import("./triangle");
	const { htmlCounterPlugin } = await import("./html-counter");
	const { htmlCounterUnifiedPlugin } = await import("./html-counter-unified");

	return [starPlugin, heartPlugin, trianglePlugin, htmlCounterPlugin, htmlCounterUnifiedPlugin];
};
