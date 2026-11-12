import { describe, expect, it } from "vitest";
import { DEFAULT_GEN } from "../elevation-field.js";
import { baseHeight, gradientNoise, hash2 } from "../elevation-noise.js";

describe("hash2", () => {
	it("is a fixed 32-bit value per lattice point and seed", () => {
		expect(hash2(0, 0, 0)).toBe(hash2(0, 0, 0));
		expect(hash2(1, 0, 0)).not.toBe(hash2(0, 1, 0));
		expect(hash2(3, 4, 1)).not.toBe(hash2(3, 4, 2));
		for (const v of [hash2(-7, 12, 5), hash2(2 ** 31, -(2 ** 31), 99)]) {
			expect(Number.isInteger(v)).toBe(true);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(2 ** 32);
		}
	});
});

describe("gradientNoise", () => {
	it("is 0 on lattice points and stays within ±1", () => {
		expect(gradientNoise(3, -2, 7)).toBe(0);
		let min = 0;
		let max = 0;
		for (let k = 0; k < 2000; k++) {
			const n = gradientNoise(k * 0.137, k * 0.291 - 50, 11);
			min = Math.min(min, n);
			max = Math.max(max, n);
		}
		expect(min).toBeGreaterThanOrEqual(-1.0001);
		expect(max).toBeLessThanOrEqual(1.0001);
		expect(max - min).toBeGreaterThan(0.8);
	});
});

describe("baseHeight", () => {
	it("stays within 0 … relief", () => {
		for (let k = 0; k < 500; k++) {
			const h = baseHeight(3, DEFAULT_GEN, k * 160, k * 96 - 30000);
			expect(h).toBeGreaterThanOrEqual(0);
			expect(h).toBeLessThanOrEqual(DEFAULT_GEN.relief);
		}
	});

	it("depends on the seed and the parameters", () => {
		expect(baseHeight(1, DEFAULT_GEN, 1000, 2000)).not.toBe(baseHeight(2, DEFAULT_GEN, 1000, 2000));
		expect(baseHeight(1, DEFAULT_GEN, 1000, 2000)).not.toBe(
			baseHeight(1, { ...DEFAULT_GEN, relief: 100 }, 1000, 2000),
		);
	});

	// Frozen outputs: every client must compute exactly these. If one changes, boards
	// already made would look different — bump the generator version (`gen.v`) instead.
	it("matches the frozen values (generator v1)", () => {
		const samples = [
			[1, 0, 0],
			[1, 16, 0],
			[1, 1024, -512],
			[42, -8000, 12345],
			[-7, 160000, -96000],
		] as const;
		expect(samples.map(([seed, x, y]) => baseHeight(seed, DEFAULT_GEN, x, y))).toEqual(GOLDEN);
	});
});

const GOLDEN = [
	128.2825, 128.209176730484, 13.899326920284759, 137.39616108044848, 139.5399826884841,
];
