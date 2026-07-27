// Active map-tool interaction state, shared between the palette UI and the tool.
// Module-scoped, app-local (not synced).
import { useSyncExternalStore } from "react";
import { createReactiveStore } from "./reactive-store.js";
import type { TerrainKey } from "./terrain.js";

export type MapMode = "brush" | "eraser" | "fill" | "stamp";

export interface MapToolState {
	mode: MapMode;
	terrain: TerrainKey;
	/** Icon key (from ICONS) used by the "stamp" mode. */
	iconKey: string;
}

export const toolStateStore = createReactiveStore<MapToolState>({
	mode: "brush",
	terrain: "grass",
	iconKey: "town",
});

/** Subscribe a component to the current map-tool state. */
export function useMapToolState(): MapToolState {
	return useSyncExternalStore(toolStateStore.subscribe, toolStateStore.get, toolStateStore.get);
}
