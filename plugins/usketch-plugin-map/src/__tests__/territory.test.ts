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

describe("computeTerritory", () => {
	it("owns the core disk regardless of paint (no tilemap)", () => {
		const store = makeStore([baseMap(B1), icon("i1", 20, 20, "b1")]);
		const t = computeTerritory(store, TILE, new Set());
		// centre cell 0,0 + the 4 orthogonal boundary cells (radius 1 tile).
		expect(new Set(Object.keys(t))).toEqual(new Set(["0,0", "1,0", "-1,0", "0,1", "0,-1"]));
		expect(t["0,0"]).toBe("b1");
	});

	it("stays bounded to the core when neighbours are unpainted (no runaway)", () => {
		// A tilemap exists but the only paint (5,5) is disconnected. Unpainted space
		// must NOT be walkable — otherwise the flood never terminates.
		const store = makeStore([baseMap(B1), icon("i1", 20, 20, "b1"), tilemap({ "5,5": "grass" })]);
		const t = computeTerritory(store, TILE, new Set());
		expect(new Set(Object.keys(t))).toEqual(new Set(["0,0", "1,0", "-1,0", "0,1", "0,-1"]));
	});

	it("grows through painted cells connected to the core", () => {
		const store = makeStore([baseMap(B1), icon("i1", 20, 20, "b1"), tilemap({ "2,0": "grass" })]);
		const t = computeTerritory(store, TILE, new Set());
		expect(t["2,0"]).toBe("b1"); // adjacent to core cell 1,0
	});

	it("excluded terrain is a wall (blocks growth beyond it)", () => {
		const store = makeStore([
			baseMap(B1),
			icon("i1", 20, 20, "b1"),
			tilemap({ "2,0": "water", "3,0": "grass" }),
		]);
		const t = computeTerritory(store, TILE, new Set(["water"]));
		expect(t["2,0"]).toBeUndefined(); // water wall, not entered
		expect(t["3,0"]).toBeUndefined(); // only reachable through the wall
	});

	it("disconnected painted cells are NOT territory", () => {
		const store = makeStore([baseMap(B1), icon("i1", 20, 20, "b1"), tilemap({ "9,9": "grass" })]);
		expect(computeTerritory(store, TILE, new Set())["9,9"]).toBeUndefined();
	});

	it("a contested painted cell goes to the nearest beacon", () => {
		const bases: Record<string, BaseInfo> = {
			b1: { name: "B1", color: "#f00", radius: 1, beaconIconId: "i1" },
			b2: { name: "B2", color: "#00f", radius: 1, beaconIconId: "i2" },
		};
		const store = makeStore([
			baseMap(bases),
			icon("i1", 20, 20, "b1"), // cell 0,0
			icon("i2", 180, 20, "b2"), // cell 4,0
			tilemap({ "2,0": "grass" }), // between the two cores (3,0)=b2 core, (1,0)=b1 core
		]);
		const t = computeTerritory(store, TILE, new Set());
		expect(t["1,0"]).toBe("b1");
		expect(t["3,0"]).toBe("b2");
		expect(t["2,0"]).toBe("b1"); // tie → deterministic (lower baseId seeds first)
	});

	it("is empty when no base has a beacon", () => {
		const store = makeStore([baseMap({ b1: { name: "B1", color: "#f00", radius: 1 } })]);
		expect(computeTerritory(store, TILE, new Set())).toEqual({});
	});

	it("memoises by cells + beacon signature", () => {
		const store = makeStore([baseMap(B1), icon("i1", 20, 20, "b1"), tilemap({ "2,0": "grass" })]);
		const a = computeTerritory(store, TILE, new Set());
		const b = computeTerritory(store, TILE, new Set());
		expect(b).toBe(a); // same reference (cache hit)
	});
});
