// Active base-tool interaction state, shared between the palette and the tool.
// Module-scoped, app-local (not synced). Base data itself lives in the synced
// `base-map` shape; this is only which base/mode the local user is editing with.
import { useSyncExternalStore } from "react";
import { createReactiveStore } from "../reactive-store.js";
import type { TerrainKey } from "../terrain.js";

export type BaseMode = "assign" | "erase" | "island" | "beacon";

export interface BaseToolState {
	/** Currently selected base id, or null when none is chosen yet. */
	activeBaseId: string | null;
	mode: BaseMode;
	/** "beacon" mode: radius (in tiles) stamped around a clicked map-icon. */
	radius: number;
	/** "beacon" mode: terrains excluded from the stamped area (e.g. water). */
	excludeTerrains: TerrainKey[];
}

export const baseStateStore = createReactiveStore<BaseToolState>({
	activeBaseId: null,
	mode: "assign",
	radius: 5,
	excludeTerrains: [],
});

export function useBaseState(): BaseToolState {
	return useSyncExternalStore(baseStateStore.subscribe, baseStateStore.get, baseStateStore.get);
}
