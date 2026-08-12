import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { DEFAULT_BASE_GEN } from "../base-terrain.js";
import {
	DEFAULT_INFINITE_SEED,
	disableInfiniteTerrain,
	enableInfiniteTerrain,
	getInfiniteSeed,
	isInfiniteTerrainEnabled,
	setInfiniteSeed,
} from "../infinite-terrain.js";
import { makeTileMap, type TileMapShapeData } from "../tilemap-shape.js";

/** Minimal in-memory BoardStore covering the methods the API uses. */
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

const tilemap = (id: string, baseSeed?: number): TileMapShapeData => ({
	...makeTileMap(40),
	id,
	...(baseSeed != null ? { baseSeed } : {}),
});

describe("infinite-terrain public API", () => {
	it("getInfiniteSeed / isInfiniteTerrainEnabled reflect the seeded tilemap", () => {
		expect(getInfiniteSeed(fakeStore())).toBeNull();
		expect(isInfiniteTerrainEnabled(fakeStore())).toBe(false);
		const store = fakeStore([tilemap("a", 42)]);
		expect(getInfiniteSeed(store)).toBe(42);
		expect(isInfiniteTerrainEnabled(store)).toBe(true);
	});

	it("enableInfiniteTerrain on a blank board creates a seeded tilemap with frozen gen", () => {
		const store = fakeStore();
		const applied = enableInfiniteTerrain(store, { seed: 7 });
		expect(applied).toBe(7);
		const tm = [...store.getShapes().values()].find(
			(s) => s.type === "tilemap",
		) as TileMapShapeData;
		expect(tm.baseSeed).toBe(7);
		expect(tm.baseGen).toEqual(DEFAULT_BASE_GEN);
	});

	it("enableInfiniteTerrain defaults to DEFAULT_INFINITE_SEED and rounds to an integer", () => {
		const store = fakeStore();
		expect(enableInfiniteTerrain(store)).toBe(DEFAULT_INFINITE_SEED);
		expect(enableInfiniteTerrain(store, { seed: 9.9 })).toBe(9);
		expect(getInfiniteSeed(store)).toBe(9);
	});

	it("enableInfiniteTerrain re-seeds the existing seeded tilemap (no new shape)", () => {
		const store = fakeStore([tilemap("a", 1)]);
		enableInfiniteTerrain(store, { seed: 2 });
		const tms = [...store.getShapes().values()].filter((s) => s.type === "tilemap");
		expect(tms).toHaveLength(1);
		expect((tms[0] as TileMapShapeData).baseSeed).toBe(2);
	});

	it("picks the lowest-id tilemap deterministically when several exist", () => {
		const store = fakeStore([tilemap("zzz"), tilemap("aaa"), tilemap("mmm")]);
		enableInfiniteTerrain(store, { seed: 5 });
		expect((store.getShape("aaa") as TileMapShapeData).baseSeed).toBe(5);
		expect((store.getShape("zzz") as TileMapShapeData).baseSeed).toBeUndefined();
	});

	it("throws on a non-finite seed", () => {
		expect(() => enableInfiniteTerrain(fakeStore(), { seed: Number.NaN })).toThrow(RangeError);
	});

	it("throws on a non-finite or non-positive tile size", () => {
		for (const tile of [0, -40, Number.NaN, Number.POSITIVE_INFINITY]) {
			expect(() => enableInfiniteTerrain(fakeStore(), { seed: 1, tile })).toThrow(RangeError);
		}
	});

	it("disableInfiniteTerrain clears baseSeed on every seeded tilemap", () => {
		const store = fakeStore([tilemap("a", 1), tilemap("b", 2)]);
		disableInfiniteTerrain(store);
		expect(getInfiniteSeed(store)).toBeNull();
	});

	it("setInfiniteSeed: number enables/re-seeds, null disables", () => {
		const store = fakeStore();
		setInfiniteSeed(store, 3);
		expect(getInfiniteSeed(store)).toBe(3);
		setInfiniteSeed(store, 4);
		expect(getInfiniteSeed(store)).toBe(4);
		setInfiniteSeed(store, null);
		expect(getInfiniteSeed(store)).toBeNull();
	});
});
