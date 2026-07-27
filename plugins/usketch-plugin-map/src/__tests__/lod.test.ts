import { describe, expect, it } from "vitest";
import type { Cells } from "../autotile.js";
import { blockFactor, downsampleCells, tileDetail } from "../lod.js";

describe("tileDetail", () => {
	it("is full only when tiles are big enough on screen", () => {
		expect(tileDetail(40)).toBe("full");
		expect(tileDetail(24)).toBe("full");
		expect(tileDetail(20)).toBe("coarse");
		expect(tileDetail(6)).toBe("coarse");
	});
	it("global lod mode forces coarse", () => {
		expect(tileDetail(40, "lod")).toBe("coarse");
	});
});

describe("blockFactor", () => {
	it("merges more as tiles shrink, keeping ~constant on-screen block size", () => {
		expect(blockFactor(24)).toBe(1); // ceil(24/24)
		expect(blockFactor(12)).toBe(2); // ceil(24/12)
		expect(blockFactor(8)).toBe(3);
		expect(blockFactor(6)).toBe(4);
		expect(blockFactor(0)).toBe(1); // guard
	});
	it("is always ≥2 below the full threshold (coarse never renders per-cell)", () => {
		for (let px = 1; px < 24; px++) expect(blockFactor(px)).toBeGreaterThanOrEqual(2);
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
