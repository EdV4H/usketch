import { describe, expect, it } from "vitest";
import type { Cells } from "./autotile.js";
import { baseTerrainAt, clearBaseCache, makeTerrainSampler } from "./base-terrain.js";

const VALID = new Set(["water", "sand", "grass", "forest", "mtn", "snow"]);

describe("baseTerrainAt", () => {
	it("is deterministic for a given seed + cell (cache-independent)", () => {
		const a = baseTerrainAt(42, 10, -7);
		clearBaseCache();
		const b = baseTerrainAt(42, 10, -7);
		expect(a).toBe(b);
	});

	it("is defined for any integer coord (negative + large)", () => {
		for (const [c, r] of [
			[0, 0],
			[-1, -1],
			[-9999, 12345],
			[500000, -400000],
		]) {
			expect(VALID.has(baseTerrainAt(1, c, r))).toBe(true);
		}
	});

	it("varies across space (not a single flat terrain)", () => {
		const seen = new Set<string>();
		for (let r = -40; r <= 40; r++) {
			for (let c = -40; c <= 40; c++) seen.add(baseTerrainAt(7, c, r));
		}
		// A reasonable seed/threshold should produce several terrain bands.
		expect(seen.size).toBeGreaterThanOrEqual(3);
	});

	it("different seeds generally differ", () => {
		let diff = 0;
		for (let c = 0; c < 50; c++) {
			if (baseTerrainAt(1, c, 0) !== baseTerrainAt(2, c, 0)) diff++;
		}
		expect(diff).toBeGreaterThan(0);
	});
});

describe("makeTerrainSampler", () => {
	const cells: Cells = { "3,4": "grass" };

	it("with a base seed: override wins, base fills the rest (total)", () => {
		const sample = makeTerrainSampler(cells, 42, null);
		expect(sample(3, 4)).toBe("grass"); // painted override
		const base = sample(100, 100);
		expect(VALID.has(base as string)).toBe(true); // generated, never undefined
		expect(base).toBe(baseTerrainAt(42, 100, 100));
	});

	it("without a base seed: falls back to the flat empty terrain", () => {
		const sample = makeTerrainSampler(cells, null, "water");
		expect(sample(3, 4)).toBe("grass");
		expect(sample(0, 0)).toBe("water"); // empty fallback
	});

	it("without base or empty: unset cells are undefined", () => {
		const sample = makeTerrainSampler(cells, null, null);
		expect(sample(3, 4)).toBe("grass");
		expect(sample(0, 0)).toBeUndefined();
	});
});
