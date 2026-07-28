// What the range-erase tool clears — user-selectable targets (multi-select).
// Module-scoped, app-local (not synced).
import { useSyncExternalStore } from "react";
import { createReactiveStore } from "./reactive-store.js";

export interface RangeEraseTargets {
	/** Clear terrain tiles (tilemap.cells) in the box. */
	terrain: boolean;
	/** Clear base ownership (base-map.owner) in the box. */
	base: boolean;
}

export const rangeEraseStore = createReactiveStore<RangeEraseTargets>({
	terrain: true,
	base: true,
});

export function useRangeEraseTargets(): RangeEraseTargets {
	return useSyncExternalStore(rangeEraseStore.subscribe, rangeEraseStore.get, rangeEraseStore.get);
}
