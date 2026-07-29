// What the range-erase tool clears. Base territory is now DERIVED (not stored),
// so it can't be box-cleared — range-erase only clears terrain paint.
// Module-scoped, app-local (not synced).
import { useSyncExternalStore } from "react";
import { createReactiveStore } from "./reactive-store.js";

export interface RangeEraseTargets {
	/** Clear terrain tiles (tilemap.cells) in the box. */
	terrain: boolean;
}

export const rangeEraseStore = createReactiveStore<RangeEraseTargets>({
	terrain: true,
});

export function useRangeEraseTargets(): RangeEraseTargets {
	return useSyncExternalStore(rangeEraseStore.subscribe, rangeEraseStore.get, rangeEraseStore.get);
}
