// The island plugin's host-facing API on the `ctx.services` seam (same convention as
// the map plugin's `map-service.ts`): the operations live in `island-elevation.ts`,
// the HUD calls them, and this bundles them store-bound for hosts / other plugins.
import {
	type BoardStore,
	defineService,
	type GroundHeightApi,
	type ServiceRegistry,
} from "@edv4h/usketch-shared";
import { getIslandElevation, islandElevationAt, setIslandElevation } from "./island-elevation.js";

type CommandSink = { execute: (cmd: { execute: () => void; undo: () => void }) => void };

/** The island plugin's host-facing operations. */
export interface IslandApi {
	/** An island's elevation in world units (0 when flat or not an island). */
	getElevation(id: string): number;
	/** Set the elevation of the given islands as one undoable command. Returns the changed ids. */
	setElevation(ids: Iterable<string>, elevation: number): string[];
	/** Ground height at a world point (highest island containing it, else 0). */
	elevationAt(x: number, y: number): number;
}

/** Typed service handle for the island API. Provide in `setup`, get via {@link getIslandApi}. */
export const islandService = defineService<IslandApi>("usketch-plugin-shape-island");

/** Build the API bound to a specific board store (called in the plugin's setup). */
export function createIslandApi(store: BoardStore, commands: CommandSink): IslandApi {
	return {
		getElevation: (id) => getIslandElevation(store.getShape(id)),
		setElevation: (ids, elevation) => setIslandElevation(store, commands, ids, elevation),
		elevationAt: (x, y) => islandElevationAt(store, x, y),
	};
}

/** The board ground-height provider backed by island elevations. */
export function createIslandGroundHeight(api: IslandApi): GroundHeightApi {
	return { heightAt: (x, y) => api.elevationAt(x, y) };
}

/** The island API from a registry (`ctx.services` / `app.services`), or `undefined`. */
export function getIslandApi(services: ServiceRegistry): IslandApi | undefined {
	return islandService.get(services);
}
