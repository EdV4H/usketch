import type { BoardStore, ServiceRegistry, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { BASE_MAP_TYPE, type BaseInfo } from "../base/base-map-shape.js";
import { createMapApi, getMapApi, mapService } from "../map-service.js";
import { TILEMAP_TYPE } from "../tilemap-shape.js";

function fakeStore(initial: ShapeData[] = []): BoardStore {
	const shapes = new Map<string, ShapeData>(initial.map((s) => [s.id, s]));
	return {
		getShapes: () => shapes,
		getShape: (id: string) => shapes.get(id),
		addShape: (s: ShapeData) => shapes.set(s.id, s),
		updateShape: (id: string, patch: Partial<ShapeData>) => {
			const s = shapes.get(id);
			if (s) shapes.set(id, { ...s, ...patch });
		},
		deleteShape: (id: string) => shapes.delete(id),
	} as unknown as BoardStore;
}

function fakeServices(): ServiceRegistry {
	const map = new Map<string, unknown>();
	return {
		provide: <T>(key: string, service: T) => {
			map.set(key, service);
			// Match core's createServiceRegistry: a stale unprovide must not delete a
			// newer provide (instance check).
			return () => {
				if (map.get(key) === service) map.delete(key);
			};
		},
		get: <T>(key: string) => map.get(key) as T | undefined,
		has: (key: string) => map.has(key),
	};
}

describe("map service seam", () => {
	it("getMapApi is undefined until the plugin provides it (optional plugin)", () => {
		expect(getMapApi(fakeServices())).toBeUndefined();
	});

	it("provides a store-bound API a host can drive without the HUD", () => {
		const store = fakeStore();
		const services = fakeServices();
		mapService.provide(services, createMapApi(store));

		const api = getMapApi(services);
		expect(api).toBeDefined();
		expect(api?.isInfiniteTerrainEnabled()).toBe(false);
		const seed = api?.enableInfiniteTerrain({ seed: 42 });
		expect(seed).toBe(42);
		expect(api?.getInfiniteSeed()).toBe(42); // reflected on the bound store
		api?.setInfiniteSeed(null);
		expect(api?.isInfiniteTerrainEnabled()).toBe(false);
	});

	it("exposes the tool/render reactive stores", () => {
		const api = createMapApi(fakeStore());
		expect(typeof api.toolState.get).toBe("function");
		expect(typeof api.renderConfig.subscribe).toBe("function");
	});
});

/** Store with a base-map (b1 beaconed at cell 0,0, radius 1) + an empty tilemap. */
function territoryStore() {
	const bases: Record<string, BaseInfo> = {
		b1: { name: "Base 1", color: "#f00", radius: 1, beaconCell: "0,0" },
	};
	const shapes = new Map<string, ShapeData>([
		["bm", { id: "bm", type: BASE_MAP_TYPE, tile: 40, bases } as unknown as ShapeData],
		[
			"tm",
			{ id: "tm", type: TILEMAP_TYPE, tile: 40, cells: {}, handPaint: {} } as unknown as ShapeData,
		],
	]);
	const listeners = new Set<(e: { type: string }) => void>();
	const store = {
		getShapes: () => shapes,
		getShape: (id: string) => shapes.get(id),
		onMutation: (l: (e: { type: string }) => void) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		emit: (e: { type: string }) => {
			for (const l of listeners) l(e);
		},
	} as unknown as BoardStore & { emit: (e: { type: string }) => void };
	return store;
}

describe("map service — territory readout (#960 follow-up)", () => {
	it("reads the base registry, derived territory, and per-region anchors", () => {
		const api = createMapApi(territoryStore(), 40);
		expect(Object.keys(api.getBases())).toEqual(["b1"]);
		// radius-1 core disk around cell 0,0
		expect(new Set(Object.keys(api.getTerritory()))).toEqual(
			new Set(["0,0", "1,0", "-1,0", "0,1", "0,-1"]),
		);
		const regions = api.getBaseRegions();
		expect(regions).toHaveLength(1);
		expect(regions[0]).toMatchObject({ baseId: "b1", name: "Base 1", count: 5 });
	});

	it("getBaseAt maps a world point to the owning base (or null)", () => {
		const api = createMapApi(territoryStore(), 40);
		expect(api.getBaseAt(20, 20)).toBe("b1"); // cell 0,0 centre
		expect(api.getBaseAt(5000, 5000)).toBeNull(); // far outside any territory
	});

	it("onTerritoryChange fires on shape mutations and stops after unsubscribe", () => {
		const store = territoryStore();
		const api = createMapApi(store, 40);
		const cb = vi.fn();
		const off = api.onTerritoryChange(cb);
		store.emit({ type: "shape:updated" });
		store.emit({ type: "viewport:changed" }); // not a shape change → ignored
		expect(cb).toHaveBeenCalledTimes(1);
		off();
		store.emit({ type: "shape:added" });
		expect(cb).toHaveBeenCalledTimes(1);
	});
});
