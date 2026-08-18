import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { type Cells, parseCellKey } from "../autotile.js";
import { BASE_MAP_TYPE, type BaseInfo } from "../base/base-map-shape.js";
import { computeTerritory } from "../base/territory.js";
import { baseTerrainAt, DEFAULT_BASE_GEN } from "../base-terrain.js";
import { TILEMAP_TYPE } from "../tilemap-shape.js";

const TILE = 40;

function baseMap(bases: Record<string, BaseInfo>): ShapeData {
	return {
		id: "bm",
		type: BASE_MAP_TYPE,
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		tile: TILE,
		bases,
	} as unknown as ShapeData;
}
function tilemap(cells: Cells, handPaint: Record<string, true> = {}): ShapeData {
	return {
		id: "tm",
		type: TILEMAP_TYPE,
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		tile: TILE,
		cells,
		handPaint,
	} as unknown as ShapeData;
}

/** Mark every key of `cells` as hand-painted (test convenience). */
function allHand(cells: Cells): Record<string, true> {
	const hp: Record<string, true> = {};
	for (const k of Object.keys(cells)) hp[k] = true;
	return hp;
}
function makeStore(shapes: ShapeData[]): BoardStore {
	const map = new Map(shapes.map((s) => [s.id, s]));
	return { getShapes: () => map } as unknown as BoardStore;
}

// Base b1 beaconed at cell "0,0" (cell centre = 20,20), radius 1.
const B1: Record<string, BaseInfo> = {
	b1: { name: "B1", color: "#f00", radius: 1, beaconCell: "0,0" },
};

describe("computeTerritory", () => {
	it("owns the core disk regardless of paint (no tilemap)", () => {
		const store = makeStore([baseMap(B1)]);
		const t = computeTerritory(store, TILE, new Set());
		// radius 1 → centre + 4 orthogonal boundary cells, always owned.
		expect(new Set(Object.keys(t))).toEqual(new Set(["0,0", "1,0", "-1,0", "0,1", "0,-1"]));
	});

	it("expands through HAND-PAINTED land beyond the radius", () => {
		// 1,0 is core (radius 1). 2,0 / 3,0 are hand-painted and connect out — they
		// join the base even though they are past the radius.
		const cells: Cells = { "2,0": "grass", "3,0": "grass" };
		const store = makeStore([baseMap(B1), tilemap(cells, allHand(cells))]);
		const t = computeTerritory(store, TILE, new Set());
		expect(t["2,0"]).toBe("b1");
		expect(t["3,0"]).toBe("b1");
	});

	it("does NOT expand through GENERATED land (the island fix)", () => {
		// Same painted cells, but NOT hand-painted (handPaint empty = generated).
		// Territory stays the core disk; the continent is not auto-claimed.
		const cells: Cells = { "2,0": "grass", "3,0": "grass", "4,0": "grass" };
		const store = makeStore([baseMap(B1), tilemap(cells, {})]);
		const t = computeTerritory(store, TILE, new Set());
		expect(t["2,0"]).toBeUndefined();
		expect(t["3,0"]).toBeUndefined();
		expect(new Set(Object.keys(t))).toEqual(new Set(["0,0", "1,0", "-1,0", "0,1", "0,-1"]));
	});

	it("hand-painted excluded terrain is a wall", () => {
		const cells: Cells = { "2,0": "water", "3,0": "grass" };
		const store = makeStore([baseMap(B1), tilemap(cells, allHand(cells))]);
		const t = computeTerritory(store, TILE, new Set(["water"]));
		expect(t["2,0"]).toBeUndefined(); // hand-painted water = wall
		expect(t["3,0"]).toBeUndefined(); // only reachable through the wall
	});

	it("disconnected hand-painted land is NOT territory", () => {
		const cells: Cells = { "9,9": "grass" };
		const store = makeStore([baseMap(B1), tilemap(cells, allHand(cells))]);
		expect(computeTerritory(store, TILE, new Set())["9,9"]).toBeUndefined();
	});

	it("overlapping cores resolve deterministically (lower baseId wins)", () => {
		const bases: Record<string, BaseInfo> = {
			b1: { name: "B1", color: "#f00", radius: 1, beaconCell: "0,0" }, // core incl. 1,0
			b2: { name: "B2", color: "#00f", radius: 1, beaconCell: "1,0" }, // core incl. 1,0 too
		};
		const store = makeStore([baseMap(bases)]);
		const t = computeTerritory(store, TILE, new Set());
		expect(t["1,0"]).toBe("b1"); // contested core cell → first sorted base
	});

	it("is empty when no base has a beacon", () => {
		const store = makeStore([baseMap({ b1: { name: "B1", color: "#f00", radius: 1 } })]);
		expect(computeTerritory(store, TILE, new Set())).toEqual({});
	});

	it("memoises by cells + beacon signature", () => {
		const cells: Cells = { "2,0": "grass" };
		const store = makeStore([baseMap(B1), tilemap(cells, allHand(cells))]);
		const a = computeTerritory(store, TILE, new Set());
		const b = computeTerritory(store, TILE, new Set());
		expect(b).toBe(a); // same reference (cache hit)
	});
});

/** A tilemap carrying an infinite-terrain seed. */
function seededTilemapShape(baseSeed: number, cells: Cells = {}): ShapeData {
	return {
		id: "tm",
		type: TILEMAP_TYPE,
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		tile: TILE,
		cells,
		handPaint: {},
		baseSeed,
	} as unknown as ShapeData;
}

describe("computeTerritory — exclude applies to effective terrain (#982)", () => {
	it("does not claim excluded terrain inside the core disk", () => {
		// cell 1,0 is inside b1's radius-1 core but is water → excludeTerrains drops it.
		const cells: Cells = { "1,0": "water" };
		const store = makeStore([baseMap(B1), tilemap(cells)]);
		const t = computeTerritory(store, TILE, new Set(["water"]));
		expect(t["1,0"]).toBeUndefined(); // excluded even though it's core
		expect(t["0,0"]).toBe("b1"); // beacon cell still owned
		expect(t["-1,0"]).toBe("b1");
	});

	it("excludes GENERATED (infinite base) sea from the core disk", () => {
		const SEED = 12345;
		const isWater = (c: number, r: number) =>
			baseTerrainAt(SEED, c, r, DEFAULT_BASE_GEN) === "water";
		// Find a generated water cell, then a land cell within ~3 tiles to beacon on
		// (so the water sits inside the radius-5 core disk).
		let water: [number, number] | null = null;
		for (let r = 0; r < 120 && !water; r++)
			for (let c = 0; c < 120; c++)
				if (isWater(c, r)) {
					water = [c, r];
					break;
				}
		expect(water).not.toBeNull();
		const [wc, wr] = water as [number, number];
		let beacon: [number, number] | null = null;
		for (let dr = -3; dr <= 3 && !beacon; dr++)
			for (let dc = -3; dc <= 3; dc++)
				if (!isWater(wc + dc, wr + dr)) {
					beacon = [wc + dc, wr + dr];
					break;
				}
		expect(beacon).not.toBeNull();
		const [bc, br] = beacon as [number, number];
		const bases: Record<string, BaseInfo> = {
			b1: { name: "B1", color: "#f00", radius: 5, beaconCell: `${bc},${br}` },
		};
		const store = makeStore([baseMap(bases), seededTilemapShape(SEED)]);
		const t = computeTerritory(store, TILE, new Set(["water"]));
		expect(t[`${bc},${br}`]).toBe("b1"); // land beacon owned
		expect(t[`${wc},${wr}`]).toBeUndefined(); // generated sea in the core is NOT owned
		// Invariant: no owned cell has (generated) water as its effective terrain.
		for (const key of Object.keys(t)) {
			const [c, r] = parseCellKey(key);
			expect(isWater(c, r)).toBe(false);
		}
	});

	it("keys the cache by baseSeed (same cells object, different seed → recompute)", () => {
		// Share ONE cells object between two seeds so both hit the same WeakMap
		// bucket: a cache that ignored baseSeed would return seed 1's territory for
		// seed 999. Radius 6 so generated water actually lands inside some cores.
		const cells: Cells = {};
		const bases: Record<string, BaseInfo> = {
			b1: { name: "B1", color: "#f00", radius: 6, beaconCell: "0,0" },
		};
		const storeA = makeStore([baseMap(bases), seededTilemapShape(1, cells)]);
		const storeB = makeStore([baseMap(bases), seededTilemapShape(999, cells)]);
		const tA = computeTerritory(storeA, TILE, new Set(["water"]));
		const tB = computeTerritory(storeB, TILE, new Set(["water"]));
		expect(tB).not.toBe(tA); // seed is part of the cache key → not a stale hit
		// Each result excludes ITS OWN seed's generated water.
		for (const key of Object.keys(tA)) {
			const [c, r] = parseCellKey(key);
			expect(baseTerrainAt(1, c, r, DEFAULT_BASE_GEN)).not.toBe("water");
		}
		for (const key of Object.keys(tB)) {
			const [c, r] = parseCellKey(key);
			expect(baseTerrainAt(999, c, r, DEFAULT_BASE_GEN)).not.toBe("water");
		}
		// Same seed twice → cache hit (unchanged fast path).
		expect(computeTerritory(storeA, TILE, new Set(["water"]))).toBe(tA);
	});
});
