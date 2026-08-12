import { describe, expect, it } from "vitest";
import type { Cells } from "./autotile.js";
import {
	type BaseGenParams,
	baseTerrainAt,
	clearBaseCache,
	DEFAULT_BASE_GEN,
	makeTerrainSampler,
	resolveBaseGen,
} from "./base-terrain.js";

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

	it("produces low bands (water/sand), not just high ground", () => {
		// Guards the zero-centred `fbm` assumption behind G_MIN/G_MAX: if the noise
		// domain ever shifted to ~[0,1], every cell would clamp high (all snow/mtn)
		// and water/sand would vanish. Sample broadly and require both to appear.
		const seen = new Set<string>();
		for (let r = -80; r <= 80; r++) {
			for (let c = -80; c <= 80; c++) seen.add(baseTerrainAt(7, c, r));
		}
		expect(seen.has("water")).toBe(true);
		expect(seen.has("sand")).toBe(true);
	});

	it("different seeds generally differ", () => {
		let diff = 0;
		for (let c = 0; c < 50; c++) {
			if (baseTerrainAt(1, c, 0) !== baseTerrainAt(2, c, 0)) diff++;
		}
		expect(diff).toBeGreaterThan(0);
	});

	it("the default gen param reproduces the implicit-default output (freeze v1)", () => {
		// Passing DEFAULT_BASE_GEN explicitly must equal the 3-arg default: this is
		// the guarantee that recording params doesn't change how v1 boards render.
		for (const [c, r] of [
			[0, 0],
			[13, -21],
			[-999, 500],
		]) {
			expect(baseTerrainAt(7, c, r, DEFAULT_BASE_GEN)).toBe(baseTerrainAt(7, c, r));
		}
	});

	it("gen params actually drive the output (a higher sea level floods more)", () => {
		const dry: BaseGenParams = { ...DEFAULT_BASE_GEN, seaLevel: 0.1 };
		const wet: BaseGenParams = { ...DEFAULT_BASE_GEN, seaLevel: 0.9 };
		const count = (g: BaseGenParams) => {
			let water = 0;
			for (let r = -30; r <= 30; r++)
				for (let c = -30; c <= 30; c++) if (baseTerrainAt(7, c, r, g) === "water") water++;
			return water;
		};
		expect(count(wet)).toBeGreaterThan(count(dry));
	});
});

describe("resolveBaseGen", () => {
	it("undefined falls back to the frozen v1 params", () => {
		const g = resolveBaseGen(undefined);
		expect(g.version).toBe(1);
		expect(g).toEqual(DEFAULT_BASE_GEN);
	});

	it("a recorded gen wins over the default", () => {
		const custom: BaseGenParams = { version: 1, scale: 0.02, seaLevel: 0.6, gMin: -0.3, gMax: 0.3 };
		expect(resolveBaseGen(custom)).toBe(custom);
	});

	it("falls back to v1 for corrupted / unsupported synced gen", () => {
		const base: BaseGenParams = {
			version: 1,
			scale: 0.05,
			seaLevel: 0.42,
			gMin: -0.25,
			gMax: 0.25,
		};
		const bad: Partial<BaseGenParams>[] = [
			{ version: 2 }, // unsupported version
			{ version: Number.NaN },
			{ scale: Number.NaN },
			{ scale: 0 }, // non-positive frequency
			{ seaLevel: 1.5 }, // out of [0,1]
			{ seaLevel: Number.POSITIVE_INFINITY },
			{ gMin: 0.3, gMax: 0.3 }, // gMin >= gMax ⇒ divide-by-zero normalisation
			{ gMin: 0.4, gMax: 0.1 },
			{ gMax: Number.NaN },
		];
		for (const patch of bad) {
			expect(resolveBaseGen({ ...base, ...patch } as BaseGenParams)).toBe(DEFAULT_BASE_GEN);
		}
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
