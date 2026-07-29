import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import type { Cells } from "../autotile.js";
import { BASE_MAP_TYPE, type BaseInfo } from "../base/base-map-shape.js";
import { computeTerritory } from "../base/territory.js";
import { MAP_ICON_TYPE } from "../map-icon-shape.js";
import { TILEMAP_TYPE } from "../tilemap-shape.js";

const TILE = 40;

/** A map-icon whose CENTRE is (cx, cy). */
function icon(id: string, cx: number, cy: number, baseId?: string): ShapeData {
	return {
		id,
		type: MAP_ICON_TYPE,
		x: cx - TILE / 2,
		y: cy - TILE / 2,
		width: TILE,
		height: TILE,
		meta: { iconKey: "town", category: "landmark", baseId },
	} as unknown as ShapeData;
}
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
function tilemap(cells: Cells): ShapeData {
	return {
		id: "tm",
		type: TILEMAP_TYPE,
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		tile: TILE,
		cells,
	} as unknown as ShapeData;
}
function makeStore(shapes: ShapeData[]): BoardStore {
	const map = new Map(shapes.map((s) => [s.id, s]));
	return { getShapes: () => map } as unknown as BoardStore;
}

const B1: Record<string, BaseInfo> = {
	b1: { name: "B1", color: "#f00", radius: 1, beaconIconId: "i1" },
};

// B2 with radius 2 for growth tests (radius 1 only reaches the 4 orthogonals).
const B2: Record<string, BaseInfo> = {
	b1: { name: "B1", color: "#f00", radius: 2, beaconIconId: "i1" },
};

describe("computeTerritory", () => {
	it("seeds the beacon cell (no paint → only that cell)", () => {
		const store = makeStore([baseMap(B1), icon("i1", 20, 20, "b1")]);
		const t = computeTerritory(store, TILE, new Set());
		expect(t).toEqual({ "0,0": "b1" });
	});

	it("grows through painted land connected to the beacon", () => {
		const store = makeStore([baseMap(B2), icon("i1", 20, 20, "b1"), tilemap({ "1,0": "grass" })]);
		const t = computeTerritory(store, TILE, new Set());
		expect(t["1,0"]).toBe("b1"); // painted, within radius, adjacent to the seed
	});

	it("does NOT claim connected land beyond the radius (the island fix)", () => {
		// A painted line runs outward. radius 1 → only the in-radius cell is claimed,
		// even though 2,0 / 3,0 are painted and connected.
		const store = makeStore([
			baseMap(B1),
			icon("i1", 20, 20, "b1"),
			tilemap({ "1,0": "grass", "2,0": "grass", "3,0": "grass" }),
		]);
		const t = computeTerritory(store, TILE, new Set());
		expect(t["1,0"]).toBe("b1"); // dist 40 ≤ radius(1)*40 → in
		expect(t["2,0"]).toBeUndefined(); // dist 80 > 40 → beyond radius
		expect(t["3,0"]).toBeUndefined();
	});

	it("excluded terrain is a wall (not claimed, blocks connectivity)", () => {
		const store = makeStore([
			baseMap(B2),
			icon("i1", 20, 20, "b1"),
			tilemap({ "1,0": "water", "2,0": "grass" }),
		]);
		const t = computeTerritory(store, TILE, new Set(["water"]));
		expect(t["1,0"]).toBeUndefined(); // water wall
		expect(t["2,0"]).toBeUndefined(); // only reachable through the wall
	});

	it("disconnected painted cells are NOT territory", () => {
		const store = makeStore([baseMap(B2), icon("i1", 20, 20, "b1"), tilemap({ "9,9": "grass" })]);
		expect(computeTerritory(store, TILE, new Set())["9,9"]).toBeUndefined();
	});

	it("overlapping beacons resolve deterministically (lower baseId wins)", () => {
		const bases: Record<string, BaseInfo> = {
			b1: { name: "B1", color: "#f00", radius: 2, beaconIconId: "i1" },
			b2: { name: "B2", color: "#00f", radius: 2, beaconIconId: "i2" },
		};
		const store = makeStore([
			baseMap(bases),
			icon("i1", 20, 20, "b1"), // cell 0,0
			icon("i2", 100, 20, "b2"), // cell 2,0
			tilemap({ "1,0": "grass" }), // in both radii; adjacent to b1's seed
		]);
		const t = computeTerritory(store, TILE, new Set());
		expect(t["1,0"]).toBe("b1"); // b1 processed first
		expect(t["2,0"]).toBe("b2"); // b2's own seed
	});

	it("is empty when no base has a beacon", () => {
		const store = makeStore([baseMap({ b1: { name: "B1", color: "#f00", radius: 1 } })]);
		expect(computeTerritory(store, TILE, new Set())).toEqual({});
	});

	it("memoises by cells + beacon signature", () => {
		const store = makeStore([baseMap(B2), icon("i1", 20, 20, "b1"), tilemap({ "1,0": "grass" })]);
		const a = computeTerritory(store, TILE, new Set());
		const b = computeTerritory(store, TILE, new Set());
		expect(b).toBe(a); // same reference (cache hit)
	});
});
