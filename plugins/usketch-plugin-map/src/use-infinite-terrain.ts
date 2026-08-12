// React hook wrapping the infinite-terrain functions (#946). Gives the "reactive
// store" ergonomics requested in the issue — a live `seed` plus enable/disable/
// setSeed controls — but bound to a BoardStore (the seed is synced shape data, not
// a module-scoped store like renderConfigStore).
import type { BoardStore, StoreEvent } from "@edv4h/usketch-shared";
import { useSyncExternalStore } from "react";
import {
	disableInfiniteTerrain,
	type EnableInfiniteTerrainOptions,
	enableInfiniteTerrain,
	getInfiniteSeed,
	setInfiniteSeed,
} from "./infinite-terrain.js";

export interface InfiniteTerrainControls {
	/** Current effective seed, or `null` when disabled. Reactive. */
	seed: number | null;
	enabled: boolean;
	/** Enable / re-seed; returns the applied integer seed. */
	enable: (opts?: EnableInfiniteTerrainOptions) => number;
	disable: () => void;
	/** Number enables/re-seeds, `null` disables. */
	setSeed: (seed: number | null) => void;
}

/**
 * Subscribe a component to the board's infinite-terrain seed and get controls to
 * change it. Re-renders when the seed changes (incl. edits from another client),
 * not on pan/zoom — it listens to shape mutations only.
 */
export function useInfiniteTerrain(store: BoardStore): InfiniteTerrainControls {
	const seed = useSyncExternalStore(
		(onChange) =>
			store.onMutation((e: StoreEvent) => {
				if (e.type === "shape:added" || e.type === "shape:removed" || e.type === "shape:updated") {
					onChange();
				}
			}),
		() => getInfiniteSeed(store),
		() => getInfiniteSeed(store),
	);
	return {
		seed,
		enabled: seed != null,
		enable: (opts) => enableInfiniteTerrain(store, opts),
		disable: () => disableInfiniteTerrain(store),
		setSeed: (s) => setInfiniteSeed(store, s),
	};
}
