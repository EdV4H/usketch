import { describe, expect, it } from "vitest";
import type { Cells } from "../autotile.js";
import type { BaseInfo, OwnerMap } from "../base/base-map-shape.js";
import {
	baseIdAtWorld,
	baseRegionAnchors,
	landRegionFrom,
	ownersEqual,
	radiusCells,
} from "../base/base-ops.js";

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

describe("radiusCells", () => {
	// tile=40; center (20,20) is the centre of cell 0,0. Radius 1 tile = 40 world,
	// so the 4 orthogonal neighbours sit exactly on the boundary (included).
	it("returns in-radius land cells (plus shape at r=1)", () => {
		const cells: Cells = {
			"0,0": "grass",
			"1,0": "grass",
			"-1,0": "grass",
			"0,1": "grass",
			"0,-1": "grass",
			"1,1": "grass", // corner: distance ~56.6 > 40 → excluded
		};
		const keys = radiusCells({ x: 20, y: 20 }, 1, cells, 40, null, new Set());
		expect(new Set(keys)).toEqual(new Set(["0,0", "1,0", "-1,0", "0,1", "0,-1"]));
	});

	it("skips excluded terrain (e.g. water)", () => {
		const cells: Cells = {
			"0,0": "grass",
			"1,0": "water",
			"-1,0": "grass",
			"0,1": "grass",
			"0,-1": "grass",
		};
		const keys = radiusCells({ x: 20, y: 20 }, 1, cells, 40, null, new Set(["water"]));
		expect(keys).not.toContain("1,0");
		expect(new Set(keys)).toEqual(new Set(["0,0", "-1,0", "0,1", "0,-1"]));
	});

	it("uses the empty-terrain fallback for unset cells", () => {
		const cells: Cells = { "0,0": "grass" };
		// truly empty → only the painted cell qualifies
		expect(radiusCells({ x: 20, y: 20 }, 1, cells, 40, null, new Set())).toEqual(["0,0"]);
		// empty="grass" → all in-radius cells count as grass
		const all = radiusCells({ x: 20, y: 20 }, 1, cells, 40, "grass", new Set());
		expect(new Set(all)).toEqual(new Set(["0,0", "1,0", "-1,0", "0,1", "0,-1"]));
		// empty="water" excluded → unset (=water) skipped, painted grass kept
		const exW = radiusCells({ x: 20, y: 20 }, 1, cells, 40, "water", new Set(["water"]));
		expect(exW).toEqual(["0,0"]);
	});

	it("returns [] for a non-positive radius", () => {
		expect(radiusCells({ x: 20, y: 20 }, 0, { "0,0": "grass" }, 40, null, new Set())).toEqual([]);
	});
});
