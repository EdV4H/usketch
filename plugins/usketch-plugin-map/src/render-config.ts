// Visual "Tweaks" for the map: colorful⇔mono, wobble⇔clean line, stroke width.
// Module-scoped so shapes/layers can subscribe before plugin setup runs. This is
// look-and-feel state (app-local), not synced board data.
import { useSyncExternalStore } from "react";
import type { ColorMode } from "./palette.js";
import { createReactiveStore } from "./reactive-store.js";
import type { TerrainKey } from "./terrain.js";

export type LineStyle = "wobble" | "clean";

export interface MapRenderConfig {
	colorMode: ColorMode;
	lineStyle: LineStyle;
	/** Multiplier on the hand-drawn stroke width (design `--sw`, base 2.6px). */
	strokeScale: number;
	/**
	 * Terrain used for unset cells. When set (e.g. "water"), unpainted / off-map
	 * space renders and is judged as that terrain — an infinite sea with painted
	 * land on top. `null` = truly empty (transparent, prior behavior).
	 */
	emptyTerrain: TerrainKey | null;
}

export const renderConfigStore = createReactiveStore<MapRenderConfig>({
	colorMode: "color",
	lineStyle: "wobble",
	strokeScale: 1,
	emptyTerrain: null,
});

/** Subscribe a component to the current Tweaks config. */
export function useRenderConfig(): MapRenderConfig {
	return useSyncExternalStore(
		renderConfigStore.subscribe,
		renderConfigStore.get,
		renderConfigStore.get,
	);
}
