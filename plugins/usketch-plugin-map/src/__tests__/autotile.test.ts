import { describe, expect, it } from "vitest";
import {
	type Cells,
	cellKey,
	cellsBounds,
	exposedEdges,
	floodFill,
	parseCellKey,
	terrainAtCell,
	worldToCell,
} from "../autotile.js";

describe("cell keys", () => {
	it("round-trips key <-> coords (incl. negatives)", () => {
		expect(cellKey(3, -2)).toBe("3,-2");
		expect(parseCellKey("3,-2")).toEqual([3, -2]);
		expect(parseCellKey("-10,-20")).toEqual([-10, -20]);
	});
});

describe("worldToCell", () => {
	it("floors world coords into the grid", () => {
		expect(worldToCell(0, 0, 40)).toEqual([0, 0]);
		expect(worldToCell(39, 39, 40)).toEqual([0, 0]);
		expect(worldToCell(40, 80, 40)).toEqual([1, 2]);
		expect(worldToCell(-1, -1, 40)).toEqual([-1, -1]);
	});
});

describe("cellsBounds", () => {
	it("returns zero box when empty", () => {
		expect(cellsBounds({}, 40)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
	});
	it("encloses all painted cells", () => {
		const cells: Cells = { "0,0": "grass", "2,1": "water" };
		expect(cellsBounds(cells, 40)).toEqual({ x: 0, y: 0, width: 120, height: 80 });
	});
	it("handles negative cells", () => {
		const cells: Cells = { "-1,-1": "grass", "0,0": "grass" };
		expect(cellsBounds(cells, 40)).toEqual({ x: -40, y: -40, width: 80, height: 80 });
	});
});

describe("terrainAtCell", () => {
	const cells: Cells = { "0,0": "grass" };
	it("returns the painted terrain when set", () => {
		expect(terrainAtCell(cells, 0, 0)).toBe("grass");
		expect(terrainAtCell(cells, 0, 0, "water")).toBe("grass");
	});
	it("falls back to the empty terrain for unset cells (off-map = sea)", () => {
		expect(terrainAtCell(cells, 9, 9, "water")).toBe("water");
	});
	it("returns undefined when unset and no fallback given", () => {
		expect(terrainAtCell(cells, 9, 9)).toBeUndefined();
		expect(terrainAtCell(cells, 9, 9, null)).toBeUndefined();
	});
});

describe("exposedEdges", () => {
	it("all sides exposed for an isolated cell", () => {
		expect(exposedEdges({ "0,0": "grass" }, 0, 0)).toEqual({ n: true, e: true, s: true, w: true });
	});
	it("shared side with same terrain is not exposed", () => {
		const cells: Cells = { "0,0": "grass", "1,0": "grass" };
		expect(exposedEdges(cells, 0, 0)).toEqual({ n: true, e: false, s: true, w: true });
	});
	it("different terrain neighbour is exposed", () => {
		const cells: Cells = { "0,0": "grass", "1,0": "water" };
		expect(exposedEdges(cells, 0, 0).e).toBe(true);
	});
});

describe("floodFill", () => {
	it("fills connected same-terrain region", () => {
		const cells: Cells = { "0,0": "grass", "1,0": "grass", "2,0": "water" };
		const keys = floodFill(cells, 0, 0);
		expect(new Set(keys)).toEqual(new Set(["0,0", "1,0"]));
	});
	it("does not cross a different terrain", () => {
		const cells: Cells = { "0,0": "grass", "1,0": "water", "2,0": "grass" };
		expect(floodFill(cells, 0, 0)).toEqual(["0,0"]);
	});
	it("empty-cell fill requires a bounding box and stays inside it", () => {
		const cells: Cells = {};
		expect(floodFill(cells, 0, 0)).toEqual([]); // unbounded empty → nothing
		const keys = floodFill(cells, 0, 0, { minC: 0, minR: 0, maxC: 1, maxR: 1 });
		expect(new Set(keys)).toEqual(new Set(["0,0", "1,0", "0,1", "1,1"]));
	});
});
