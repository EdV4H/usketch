// The map plugin's host-facing API, published on the `ctx.services` seam so a host
// (or any other plugin) can drive map operations WITHOUT the Control HUD and
// without importing individual helpers. This is the reference for the convention
// in docs/plugin-system-design.md: operation logic lives in plain functions, the
// HUD/actions call them, and the same functions are bundled into a service.
import { type BoardStore, defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import type { BaseInfo } from "./base/base-map-shape.js";
import {
	type BaseRegionAnchor,
	baseIdAtWorld,
	baseRegionAnchors,
	getBaseMap,
} from "./base/base-ops.js";
import { baseStateStore } from "./base/base-state.js";
import { computeTerritory, type Territory } from "./base/territory.js";
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
import { DEFAULT_TILE } from "./tilemap-shape.js";
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
	// ── Base "territory" (領域) readout — derived, read-only. Lets a host drive its
	//    own UI (minimap, area labels, "you are in X") without importing helpers. ──
	/** The full derived territory: `cellKey("c,r") → baseId`. */
	getTerritory(): Territory;
	/** Base id owning the cell at a world point, or `null`. */
	getBaseAt(x: number, y: number): string | null;
	/** The base registry: `baseId → { name, color, radius, beaconCell }`. */
	getBases(): Record<string, BaseInfo>;
	/** One anchor per base that owns cells: centre (world), colour, name, cell count. */
	getBaseRegions(): BaseRegionAnchor[];
	/** Fire `listener` whenever the territory could have changed (shapes / exclude set). Returns an unsubscribe. */
	onTerritoryChange(listener: () => void): () => void;
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
export function createMapApi(store: BoardStore, defaultTile = DEFAULT_TILE): MapApi {
	// The base-map carries its own tile; fall back to the plugin's configured tile.
	const tileOf = () => getBaseMap(store)?.tile ?? defaultTile;
	const territoryOf = (): Territory =>
		computeTerritory(store, tileOf(), new Set(baseStateStore.get().excludeTerrains));
	return {
		enableInfiniteTerrain: (opts) => enableInfiniteTerrain(store, opts),
		disableInfiniteTerrain: () => disableInfiniteTerrain(store),
		getInfiniteSeed: () => getInfiniteSeed(store),
		isInfiniteTerrainEnabled: () => isInfiniteTerrainEnabled(store),
		setInfiniteSeed: (seed) => setInfiniteSeed(store, seed),
		getTerritory: territoryOf,
		getBaseAt: (x, y) => baseIdAtWorld(territoryOf(), x, y, tileOf()),
		getBases: () => getBaseMap(store)?.bases ?? {},
		getBaseRegions: () =>
			baseRegionAnchors(territoryOf(), getBaseMap(store)?.bases ?? {}, tileOf()),
		onTerritoryChange: (listener) => {
			// Territory derives from the base-map + tilemap shapes and the exclude set.
			const offShapes = store.onMutation((e) => {
				if (e.type === "shape:added" || e.type === "shape:removed" || e.type === "shape:updated")
					listener();
			});
			const offExclude = baseStateStore.subscribe(listener);
			return () => {
				offShapes();
				offExclude();
			};
		},
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
