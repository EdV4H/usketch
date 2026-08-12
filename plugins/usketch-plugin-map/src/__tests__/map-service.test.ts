import type { BoardStore, ServiceRegistry, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createMapApi, getMapApi, mapService } from "../map-service.js";

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
