import { describe, expect, it } from "vitest";
import type { Cells } from "../autotile.js";
import type { BaseInfo, OwnerMap } from "../base/base-map-shape.js";
import { baseIdAtWorld, baseRegionAnchors, landRegionFrom, ownersEqual } from "../base/base-ops.js";

describe("baseIdAtWorld", () => {
	const owner: OwnerMap = { "0,0": "red", "1,0": "blue" };
	it("maps a world point to the owning base", () => {
		expect(baseIdAtWorld(owner, 10, 10, 40)).toBe("red"); // cell 0,0
		expect(baseIdAtWorld(owner, 50, 10, 40)).toBe("blue"); // cell 1,0
	});
	it("returns null for unowned cells", () => {
		expect(baseIdAtWorld(owner, 200, 200, 40)).toBeNull();
	});
});

describe("landRegionFrom", () => {
	it("floods connected land without crossing water", () => {
		// row: grass grass water grass  → from 0,0 reaches 0,0 and 1,0 only
		const cells: Cells = { "0,0": "grass", "1,0": "forest", "2,0": "water", "3,0": "grass" };
		expect(new Set(landRegionFrom(cells, 0, 0))).toEqual(new Set(["0,0", "1,0"]));
	});
	it("returns empty when the start is water or empty", () => {
		const cells: Cells = { "0,0": "water" };
		expect(landRegionFrom(cells, 0, 0)).toEqual([]);
		expect(landRegionFrom({}, 5, 5)).toEqual([]);
	});
	it("includes diagonally-separated-but-4-connected land", () => {
		// an L shape of land
		const cells: Cells = { "0,0": "grass", "0,1": "sand", "1,1": "mtn" };
		expect(new Set(landRegionFrom(cells, 0, 0))).toEqual(new Set(["0,0", "0,1", "1,1"]));
	});
});

describe("ownersEqual", () => {
	it("detects no-op strokes (used to skip empty undo entries)", () => {
		expect(ownersEqual({ "0,0": "red" }, { "0,0": "red" })).toBe(true);
		expect(ownersEqual({ "0,0": "red" }, { "0,0": "blue" })).toBe(false);
		expect(ownersEqual({ "0,0": "red" }, {})).toBe(false);
		expect(ownersEqual({ "0,0": "red" }, { "0,0": "red", "1,0": "red" })).toBe(false);
	});
});

describe("baseRegionAnchors", () => {
	const bases: Record<string, BaseInfo> = {
		red: { name: "Red", color: "#EF5350" },
		blue: { name: "Blue", color: "#4A7FB8" },
	};
	it("gives one centred anchor per base that owns cells", () => {
		const owner: OwnerMap = { "0,0": "red", "2,0": "red", "10,10": "blue" };
		const anchors = baseRegionAnchors(owner, bases, 40);
		const red = anchors.find((a) => a.baseId === "red");
		expect(red?.count).toBe(2);
		// bbox cols 0..2 → centre = (0+2+1)/2 * 40 = 60
		expect(red?.x).toBe(60);
		expect(red?.name).toBe("Red");
		expect(anchors.find((a) => a.baseId === "blue")?.count).toBe(1);
	});
	it("skips bases with no owned cells and unknown base ids", () => {
		const owner: OwnerMap = { "0,0": "ghost" }; // base not in registry
		expect(baseRegionAnchors(owner, bases, 40)).toEqual([]);
	});
});
