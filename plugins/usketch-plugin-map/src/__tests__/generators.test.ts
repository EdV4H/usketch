import { describe, expect, it } from "vitest";
import type { CellBox } from "../autotile.js";
import { defaultParams, elevationToTerrain, GENERATORS_BY_ID } from "../generators/index.js";
import { fbm } from "../generators/noise.js";

const BOX: CellBox = { minC: 0, minR: 0, maxC: 9, maxR: 7 }; // 10×8 = 80 cells
const noise = GENERATORS_BY_ID.get("noise")!;
const islands = GENERATORS_BY_ID.get("islands")!;
const island = GENERATORS_BY_ID.get("island")!;

function countWater(cells: Record<string, string>): number {
	return Object.values(cells).filter((t) => t === "water").length;
}

describe("elevationToTerrain", () => {
	it("bands from water → snow around the sea level", () => {
		expect(elevationToTerrain(0.1, 0.4)).toBe("water");
		expect(elevationToTerrain(0.42, 0.4)).toBe("sand");
		expect(elevationToTerrain(0.55, 0.4)).toBe("grass");
		expect(elevationToTerrain(0.99, 0.4)).toBe("snow");
	});
	it("raising sea level turns mid elevations into water", () => {
		expect(elevationToTerrain(0.45, 0.4)).not.toBe("water");
		expect(elevationToTerrain(0.45, 0.6)).toBe("water");
	});
});

describe("generators", () => {
	it("cover every cell in the box", () => {
		const cells = noise.generate({ box: BOX, seed: 1, params: defaultParams(noise) });
		expect(Object.keys(cells)).toHaveLength(80);
	});

	it("are deterministic for the same seed/params/box", () => {
		const p = defaultParams(noise);
		const a = noise.generate({ box: BOX, seed: 42, params: p });
		const b = noise.generate({ box: BOX, seed: 42, params: p });
		expect(a).toEqual(b);
	});

	it("the noise field varies with the seed (and is deterministic)", () => {
		expect(fbm(1, 3, 5, 0.3)).toBe(fbm(1, 3, 5, 0.3));
		expect(fbm(1, 3, 5, 0.3)).not.toBe(fbm(2, 3, 5, 0.3));
	});

	it("generator output differs for different seeds over a large area", () => {
		const big = { minC: 0, minR: 0, maxC: 31, maxR: 31 };
		const p = { scale: 0.3, seaLevel: 0.4 };
		const a = noise.generate({ box: big, seed: 1, params: p });
		const b = noise.generate({ box: big, seed: 2, params: p });
		expect(a).not.toEqual(b);
	});

	it("default params yield a real land/water mix, not all ocean", () => {
		const big = { minC: 0, minR: 0, maxC: 39, maxR: 29 }; // 40×30
		for (const g of [noise, islands]) {
			const cells = g.generate({ box: big, seed: 5, params: defaultParams(g) });
			const water = countWater(cells);
			const total = Object.keys(cells).length;
			expect(water).toBeGreaterThan(0); // some sea
			expect(water).toBeLessThan(total); // but not everything
			const land = total - water;
			expect(land).toBeGreaterThan(total * 0.1); // at least ~10% land
		}
	});

	it("a 1×1 (flat) box is not forced to water by normalisation", () => {
		const one = { minC: 0, minR: 0, maxC: 0, maxR: 0 };
		const cells = noise.generate({ box: one, seed: 5, params: defaultParams(noise) });
		expect(Object.keys(cells)).toHaveLength(1);
		expect(cells["0,0"]).not.toBe("water"); // neutral 0.5 > default seaLevel
	});

	it("raising seaLevel monotonically increases water", () => {
		const low = noise.generate({ box: BOX, seed: 7, params: { scale: 0.1, seaLevel: 0.3 } });
		const high = noise.generate({ box: BOX, seed: 7, params: { scale: 0.1, seaLevel: 0.7 } });
		expect(countWater(high)).toBeGreaterThan(countWater(low));
	});

	it("island: the entire box border is water, with land inside", () => {
		const box = { minC: 0, minR: 0, maxC: 23, maxR: 17 }; // 24×18
		const cells = island.generate({ box, seed: 9, params: defaultParams(island) });
		// Every border cell must be water (a single island surrounded by sea).
		for (let c = box.minC; c <= box.maxC; c++) {
			expect(cells[`${c},${box.minR}`]).toBe("water");
			expect(cells[`${c},${box.maxR}`]).toBe("water");
		}
		for (let r = box.minR; r <= box.maxR; r++) {
			expect(cells[`${box.minC},${r}`]).toBe("water");
			expect(cells[`${box.maxC},${r}`]).toBe("water");
		}
		// ...but there is land somewhere in the middle.
		const total = Object.keys(cells).length;
		const water = countWater(cells);
		expect(total - water).toBeGreaterThan(0);
	});

	it("island: border stays water even at seaLevel 0", () => {
		const box = { minC: 0, minR: 0, maxC: 15, maxR: 11 };
		const cells = island.generate({ box, seed: 4, params: { scale: 0.1, seaLevel: 0, size: 3 } });
		for (let c = box.minC; c <= box.maxC; c++) {
			expect(cells[`${c},${box.minR}`]).toBe("water");
			expect(cells[`${c},${box.maxR}`]).toBe("water");
		}
	});

	it("islands falloff makes the box border water", () => {
		const cells = islands.generate({
			box: BOX,
			seed: 3,
			params: { scale: 0.1, seaLevel: 0.5, falloff: 1 },
		});
		// Every corner cell should be water (strong edge falloff).
		for (const key of ["0,0", "9,0", "0,7", "9,7"]) {
			expect(cells[key]).toBe("water");
		}
	});
});
