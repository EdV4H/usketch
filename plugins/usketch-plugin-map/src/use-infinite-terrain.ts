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
				// Only recompute the seed when something could actually change it — not on
				// every edit (tile painting fires shape:updated on the tilemap constantly,
				// changing cells/bounds but not baseSeed).
				if (e.type === "shape:updated") {
					const { before, after } = e.payload;
					if (isTileMap(after)) {
						const prev = isTileMap(before) ? before.baseSeed : undefined;
						if (prev !== after.baseSeed) onChange(); // baseSeed actually changed
					}
				} else if (e.type === "shape:added") {
					// A new tilemap affects the effective seed only if it already carries one.
					const seededAdded = e.payload.ids.some((id) => {
						const s = store.getShape(id);
						return s != null && isTileMap(s) && s.baseSeed != null;
					});
					if (seededAdded) onChange();
				} else if (e.type === "shape:removed") {
					// The removed shapes are already gone (can't inspect); a removed seeded
					// tilemap can change the effective seed, so recompute conservatively.
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
