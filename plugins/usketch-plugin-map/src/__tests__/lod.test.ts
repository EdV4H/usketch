import { describe, expect, it } from "vitest";
import type { Cells } from "../autotile.js";
import { blockFactor, downsampleCells, tileDetail } from "../lod.js";

describe("tileDetail", () => {
	it("picks tier by on-screen tile size", () => {
		expect(tileDetail(40)).toBe("full"); // 40px/tile → full
		expect(tileDetail(14)).toBe("full");
		expect(tileDetail(10)).toBe("mid");
		expect(tileDetail(6)).toBe("mid");
		expect(tileDetail(3)).toBe("low");
	});
	it("global lod mode caps detail at mid", () => {
		expect(tileDetail(40, "lod")).toBe("mid");
		expect(tileDetail(3, "lod")).toBe("low");
	});
});

describe("blockFactor", () => {
	it("is 1 when tiles are large, grows as they shrink", () => {
		expect(blockFactor(12)).toBe(1);
		expect(blockFactor(4)).toBe(3); // round(12/4)
		expect(blockFactor(1)).toBe(12);
		expect(blockFactor(0)).toBe(1); // guard
	});
});

describe("downsampleCells", () => {
	it("returns a shallow copy when factor <= 1", () => {
		const cells: Cells = { "0,0": "grass" };
		const out = downsampleCells(cells, 1);
		expect(out).toEqual(cells);
		expect(out).not.toBe(cells);
	});
	it("merges a factor×factor block to its majority terrain", () => {
		// One 2×2 block: 3 grass + 1 water → grass.
		const cells: Cells = { "0,0": "grass", "1,0": "grass", "0,1": "grass", "1,1": "water" };
		const out = downsampleCells(cells, 2);
		expect(Object.keys(out)).toEqual(["0,0"]); // single block at block-coord 0,0
		expect(out["0,0"]).toBe("grass");
	});
	it("keys are block coordinates", () => {
		const cells: Cells = { "4,4": "forest", "5,5": "forest" };
		const out = downsampleCells(cells, 2); // cells 4,5 → block 2
		expect(out["2,2"]).toBe("forest");
	});
	it("caches the block map per cells object + factor (same reference)", () => {
		const cells: Cells = { "0,0": "grass", "1,0": "water" };
		expect(downsampleCells(cells, 2)).toBe(downsampleCells(cells, 2)); // cache hit
		const other: Cells = { "0,0": "grass", "1,0": "water" };
		expect(downsampleCells(other, 2)).not.toBe(downsampleCells(cells, 2)); // different object
	});
});
