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

const B1: Record<string, BaseInfo> = {
	b1: { name: "B1", color: "#f00", radius: 1, beaconIconId: "i1" },
};

describe("computeTerritory", () => {
	it("owns the core disk regardless of paint (no tilemap)", () => {
		const store = makeStore([baseMap(B1), icon("i1", 20, 20, "b1")]);
		const t = computeTerritory(store, TILE, new Set());
		// radius 1 → centre + 4 orthogonal boundary cells, always owned.
		expect(new Set(Object.keys(t))).toEqual(new Set(["0,0", "1,0", "-1,0", "0,1", "0,-1"]));
	});

	it("expands through HAND-PAINTED land beyond the radius", () => {
		// 1,0 is core (radius 1). 2,0 / 3,0 are hand-painted and connect out — they
		// join the base even though they are past the radius.
		const cells: Cells = { "2,0": "grass", "3,0": "grass" };
		const store = makeStore([
			baseMap(B1),
			icon("i1", 20, 20, "b1"),
			tilemap(cells, allHand(cells)),
		]);
		const t = computeTerritory(store, TILE, new Set());
		expect(t["2,0"]).toBe("b1");
		expect(t["3,0"]).toBe("b1");
	});

	it("does NOT expand through GENERATED land (the island fix)", () => {
		// Same painted cells, but NOT hand-painted (handPaint empty = generated).
		// Territory stays the core disk; the continent is not auto-claimed.
		const cells: Cells = { "2,0": "grass", "3,0": "grass", "4,0": "grass" };
		const store = makeStore([baseMap(B1), icon("i1", 20, 20, "b1"), tilemap(cells, {})]);
		const t = computeTerritory(store, TILE, new Set());
		expect(t["2,0"]).toBeUndefined();
		expect(t["3,0"]).toBeUndefined();
		expect(new Set(Object.keys(t))).toEqual(new Set(["0,0", "1,0", "-1,0", "0,1", "0,-1"]));
	});

	it("hand-painted excluded terrain is a wall", () => {
		const cells: Cells = { "2,0": "water", "3,0": "grass" };
		const store = makeStore([
			baseMap(B1),
			icon("i1", 20, 20, "b1"),
			tilemap(cells, allHand(cells)),
		]);
		const t = computeTerritory(store, TILE, new Set(["water"]));
		expect(t["2,0"]).toBeUndefined(); // hand-painted water = wall
		expect(t["3,0"]).toBeUndefined(); // only reachable through the wall
	});

	it("disconnected hand-painted land is NOT territory", () => {
		const cells: Cells = { "9,9": "grass" };
		const store = makeStore([
			baseMap(B1),
			icon("i1", 20, 20, "b1"),
			tilemap(cells, allHand(cells)),
		]);
		expect(computeTerritory(store, TILE, new Set())["9,9"]).toBeUndefined();
	});

	it("overlapping cores resolve deterministically (lower baseId wins)", () => {
		const bases: Record<string, BaseInfo> = {
			b1: { name: "B1", color: "#f00", radius: 1, beaconIconId: "i1" },
			b2: { name: "B2", color: "#00f", radius: 1, beaconIconId: "i2" },
		};
		const store = makeStore([
			baseMap(bases),
			icon("i1", 20, 20, "b1"), // cell 0,0 → core incl. 1,0
			icon("i2", 60, 20, "b2"), // cell 1,0 → core incl. 1,0 too
		]);
		const t = computeTerritory(store, TILE, new Set());
		expect(t["1,0"]).toBe("b1"); // contested core cell → first sorted base
	});

	it("is empty when no base has a beacon", () => {
		const store = makeStore([baseMap({ b1: { name: "B1", color: "#f00", radius: 1 } })]);
		expect(computeTerritory(store, TILE, new Set())).toEqual({});
	});

	it("memoises by cells + beacon signature", () => {
		const cells: Cells = { "2,0": "grass" };
		const store = makeStore([
			baseMap(B1),
			icon("i1", 20, 20, "b1"),
			tilemap(cells, allHand(cells)),
		]);
		const a = computeTerritory(store, TILE, new Set());
		const b = computeTerritory(store, TILE, new Set());
		expect(b).toBe(a); // same reference (cache hit)
	});
});
