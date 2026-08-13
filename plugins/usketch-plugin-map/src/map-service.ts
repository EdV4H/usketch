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
import { isIconStructural, setIconStructural } from "./structural-icon.js";
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
	// ── Structural ("world layer") map-icons (#955): Select-protected, Map-editable ──
	/** Whether the map-icon `id` is structural (Select can't touch it, Map can edit it). */
	isIconStructural(id: string): boolean;
	/**
	 * Mark a map-icon structural (`true`, also sets `locked:true`) or normal (`false`,
	 * clears the lock). No-op on a missing / non-map-icon shape.
	 */
	setIconStructural(id: string, structural: boolean): void;
	// ── Reactive stores backing the map tool + Tweaks (get/set/subscribe). NOTE:
	//    these are MODULE-SCOPED singletons, not bound to this store like the ops
	//    above — so multiple AppInstances in the same JS runtime SHARE them. They are
	//    app-local per-user presentation state (never synced across clients). ──
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
		isIconStructural: (id) => isIconStructural(store, id),
		setIconStructural: (id, structural) => setIconStructural(store, id, structural),
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
