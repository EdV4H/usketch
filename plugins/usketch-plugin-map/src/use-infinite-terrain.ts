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
import { isTileMap } from "./tilemap-shape.js";

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
				// Only recompute the seed for tilemap-affecting mutations — most edits
				// touch unrelated shapes and can't change baseSeed. (useSyncExternalStore
				// still bails the actual re-render when the seed value is unchanged.)
				if (e.type === "shape:added" || e.type === "shape:updated") {
					const touchesTilemap = e.payload.ids.some((id) => {
						const s = store.getShape(id);
						return s != null && isTileMap(s);
					});
					if (touchesTilemap) onChange();
				} else if (e.type === "shape:removed") {
					// The removed shapes are already gone (can't inspect); a removed tilemap
					// can change the effective seed, so recompute conservatively on removal.
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
