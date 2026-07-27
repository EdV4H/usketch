// Visual "Tweaks" for the map: colorful⇔mono, wobble⇔clean line, stroke width.
// Module-scoped so shapes/layers can subscribe before plugin setup runs. This is
// look-and-feel state (app-local), not synced board data.
import { useSyncExternalStore } from "react";
import type { ColorMode } from "./palette.js";
import { createReactiveStore } from "./reactive-store.js";

export type LineStyle = "wobble" | "clean";

export interface MapRenderConfig {
	colorMode: ColorMode;
	lineStyle: LineStyle;
	/** Multiplier on the hand-drawn stroke width (design `--sw`, base 2.6px). */
	strokeScale: number;
}

export const renderConfigStore = createReactiveStore<MapRenderConfig>({
	colorMode: "color",
	lineStyle: "wobble",
	strokeScale: 1,
});

/** Subscribe a component to the current Tweaks config. */
export function useRenderConfig(): MapRenderConfig {
	return useSyncExternalStore(
		renderConfigStore.subscribe,
		renderConfigStore.get,
		renderConfigStore.get,
	);
}
