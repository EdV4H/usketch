// The map plugin's host-facing API, published on the `ctx.services` seam so a host
// (or any other plugin) can drive map operations WITHOUT the Control HUD and
// without importing individual helpers. This is the reference for the convention
// in docs/plugin-system-design.md: operation logic lives in plain functions, the
// HUD/actions call them, and the same functions are bundled into a service.
import { type BoardStore, defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import {
	disableInfiniteTerrain,
	type EnableInfiniteTerrainOptions,
	enableInfiniteTerrain,
	getInfiniteSeed,
	isInfiniteTerrainEnabled,
	setInfiniteSeed,
} from "./infinite-terrain.js";
import type { ReactiveStore } from "./reactive-store.js";
import { type MapRenderConfig, renderConfigStore } from "./render-config.js";
import { type MapToolState, toolStateStore } from "./tool-state.js";

/** The map plugin's host-facing operations + live stores. */
export interface MapApi {
	// ── Infinite base terrain (store-bound; the host needn't pass the store) ──
	/** Enable/re-seed the infinite base terrain. Returns the applied integer seed. */
	enableInfiniteTerrain(opts?: EnableInfiniteTerrainOptions): number;
	disableInfiniteTerrain(): void;
	/** Current effective seed, or `null` when disabled. */
	getInfiniteSeed(): number | null;
	isInfiniteTerrainEnabled(): boolean;
	/** A number enables/re-seeds, `null` disables. */
	setInfiniteSeed(seed: number | null): void;
	// ── App-local reactive stores backing the map tool + Tweaks (get/set/subscribe) ──
	toolState: ReactiveStore<MapToolState>;
	renderConfig: ReactiveStore<MapRenderConfig>;
}

/** Typed service handle for the map API. Provide in `setup`, get via {@link getMapApi}. */
export const mapService = defineService<MapApi>("usketch-plugin-map");

/** Build the API bound to a specific board store (called in the plugin's setup). */
export function createMapApi(store: BoardStore): MapApi {
	return {
		enableInfiniteTerrain: (opts) => enableInfiniteTerrain(store, opts),
		disableInfiniteTerrain: () => disableInfiniteTerrain(store),
		getInfiniteSeed: () => getInfiniteSeed(store),
		isInfiniteTerrainEnabled: () => isInfiniteTerrainEnabled(store),
		setInfiniteSeed: (seed) => setInfiniteSeed(store, seed),
		toolState: toolStateStore,
		renderConfig: renderConfigStore,
	};
}

/**
 * Host accessor: `getMapApi(app.services)?.enableInfiniteTerrain({ seed })`. Returns
 * `undefined` when the map plugin isn't active. Works with `ctx.services` too.
 */
export function getMapApi(services: ServiceRegistry): MapApi | undefined {
	return mapService.get(services);
}
