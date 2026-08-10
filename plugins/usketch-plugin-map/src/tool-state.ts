// Active map-tool interaction state, shared between the palette UI and the tool.
// Module-scoped, app-local (not synced).
import { useSyncExternalStore } from "react";
import { createReactiveStore } from "./reactive-store.js";
import type { TerrainKey } from "./terrain.js";

/**
 * All map-tool modes, in canonical order. Exported so a host UI (ActionRing /
 * radial picker / custom toolbar) can enumerate the modes at runtime instead of
 * hardcoding the union. `MapMode` is derived from this array — single source.
 */
export const MAP_MODES = [
	"brush",
	"eraser",
	"fill",
	"region",
	"stamp",
	"generate",
	"base",
] as const;

export type MapMode = (typeof MAP_MODES)[number];

export interface MapToolState {
	mode: MapMode;
	terrain: TerrainKey;
	/** Icon key (from ICONS) used by the "stamp" mode. */
	iconKey: string;
	/**
	 * Terrains protected from the "region" fill: cells of these terrains are never
	 * overwritten, and clicking one is a no-op. Lets the user fill a connected
	 * same-terrain area while keeping specific tiles (e.g. water) safe.
	 */
	excludeTerrains: TerrainKey[];
}

export const toolStateStore = createReactiveStore<MapToolState>({
	mode: "brush",
	terrain: "grass",
	iconKey: "town",
	excludeTerrains: [],
});

/** Subscribe a component to the current map-tool state. */
export function useMapToolState(): MapToolState {
	return useSyncExternalStore(toolStateStore.subscribe, toolStateStore.get, toolStateStore.get);
}
