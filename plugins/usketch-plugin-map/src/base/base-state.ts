// Active base-tool interaction state, shared between the HUD and the tool.
// Module-scoped, app-local (not synced). Base data itself lives in the synced
// `base-map` shape; this is only which base the local user edits with, plus the
// terrains excluded from territory growth (a wall for the connectivity flood).
import { useSyncExternalStore } from "react";
import { createReactiveStore } from "../reactive-store.js";
import type { TerrainKey } from "../terrain.js";

export interface BaseToolState {
	/** Currently selected base id, or null when none is chosen yet. */
	activeBaseId: string | null;
	/** Terrains that block territory growth (e.g. water). Global for all bases. */
	excludeTerrains: TerrainKey[];
}

export const baseStateStore = createReactiveStore<BaseToolState>({
	activeBaseId: null,
	excludeTerrains: [],
});

export function useBaseState(): BaseToolState {
	return useSyncExternalStore(baseStateStore.subscribe, baseStateStore.get, baseStateStore.get);
}
