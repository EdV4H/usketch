import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { DEFAULT_BASE_GEN, regionSizeOf, scaleForRegionSize } from "../base-terrain.js";
import {
	DEFAULT_INFINITE_SEED,
	disableInfiniteTerrain,
	enableInfiniteTerrain,
	getInfiniteGen,
	getInfiniteSeed,
	isInfiniteTerrainEnabled,
	setInfiniteGen,
	setInfiniteRegion,
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

	it("enableInfiniteTerrain stamps the given gen (scale / seaLevel) over the defaults", () => {
		const store = fakeStore();
		enableInfiniteTerrain(store, { seed: 1, gen: { scale: 0.025, seaLevel: 0.5 } });
		expect(getInfiniteGen(store)).toEqual({ ...DEFAULT_BASE_GEN, scale: 0.025, seaLevel: 0.5 });
	});

	it("enableInfiniteTerrain without gen keeps the board's recorded gen", () => {
		const store = fakeStore();
		enableInfiniteTerrain(store, { seed: 1, gen: { scale: 0.025 } });
		enableInfiniteTerrain(store, { seed: 2 });
		expect(getInfiniteGen(store)?.scale).toBe(0.025);
		expect(getInfiniteSeed(store)).toBe(2);
	});

	it("enableInfiniteTerrain rejects an out-of-range gen without touching the board", () => {
		for (const gen of [
			{ scale: 0 },
			{ scale: Number.NaN },
			{ scale: Number.POSITIVE_INFINITY },
			{ scale: scaleForRegionSize(8) },
			{ scale: scaleForRegionSize(0.25) },
			{ seaLevel: -0.1 },
			{ seaLevel: 1.5 },
		]) {
			const store = fakeStore();
			expect(() => enableInfiniteTerrain(store, { seed: 1, gen })).toThrow(RangeError);
			expect(store.getShapes().size).toBe(0);
		}
	});

	it("getInfiniteGen gives the gen turning the terrain on will use", () => {
		expect(getInfiniteGen(fakeStore())).toEqual(DEFAULT_BASE_GEN);
		const store = fakeStore([tilemap("a")]);
		enableInfiniteTerrain(store, { seed: 1, gen: { scale: 0.025 } });
		disableInfiniteTerrain(store);
		expect(getInfiniteGen(store).scale).toBe(0.025);
		enableInfiniteTerrain(store);
		expect(getInfiniteGen(store).scale).toBe(0.025);
	});

	it("setInfiniteGen re-generates while enabled, keeping the seed", () => {
		const on = fakeStore([tilemap("a", 9)]);
		expect(setInfiniteGen(on, { seaLevel: 0.6 })).toBe(true);
		expect(getInfiniteGen(on).seaLevel).toBe(0.6);
		expect(getInfiniteGen(on).scale).toBe(DEFAULT_BASE_GEN.scale);
		expect(getInfiniteSeed(on)).toBe(9);
	});

	it("setInfiniteGen while disabled records the gen for turning it on", () => {
		expect(setInfiniteGen(fakeStore(), { seaLevel: 0.6 })).toBe(false);
		const off = fakeStore([tilemap("a")]);
		expect(setInfiniteGen(off, { seaLevel: 0.6 })).toBe(true);
		expect(isInfiniteTerrainEnabled(off)).toBe(false);
		enableInfiniteTerrain(off, { seed: 1 });
		expect(getInfiniteGen(off).seaLevel).toBe(0.6);
	});

	it("setInfiniteRegion clamps the region size and sea level, and ignores junk", () => {
		const store = fakeStore([tilemap("a", 1)]);
		expect(setInfiniteRegion(store, { regionSize: 100, seaLevel: -1 })).toBe(true);
		expect(regionSizeOf(getInfiniteGen(store))).toBeCloseTo(4, 12);
		expect(getInfiniteGen(store).seaLevel).toBe(0);
		expect(setInfiniteRegion(store, { regionSize: 1e-320 })).toBe(true);
		expect(regionSizeOf(getInfiniteGen(store))).toBeCloseTo(0.5, 12);
		expect(setInfiniteRegion(store, { regionSize: Number.NaN })).toBe(false);
		expect(regionSizeOf(getInfiniteGen(store))).toBeCloseTo(0.5, 12);
	});

	it("region size is a multiple of the default scale (2 = twice as wide)", () => {
		expect(scaleForRegionSize(2)).toBeCloseTo(DEFAULT_BASE_GEN.scale / 2, 12);
		expect(regionSizeOf({ scale: scaleForRegionSize(2) })).toBeCloseTo(2, 12);
		expect(regionSizeOf(DEFAULT_BASE_GEN)).toBe(1);
	});
});
