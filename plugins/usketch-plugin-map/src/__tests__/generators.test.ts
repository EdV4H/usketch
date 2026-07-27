import { describe, expect, it } from "vitest";
import type { CellBox } from "../autotile.js";
import { defaultParams, elevationToTerrain, GENERATORS_BY_ID } from "../generators/index.js";
import { fbm } from "../generators/noise.js";

const BOX: CellBox = { minC: 0, minR: 0, maxC: 9, maxR: 7 }; // 10×8 = 80 cells
const noise = GENERATORS_BY_ID.get("noise")!;
const islands = GENERATORS_BY_ID.get("islands")!;

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

	it("raising seaLevel monotonically increases water", () => {
		const low = noise.generate({ box: BOX, seed: 7, params: { scale: 0.1, seaLevel: 0.3 } });
		const high = noise.generate({ box: BOX, seed: 7, params: { scale: 0.1, seaLevel: 0.7 } });
		expect(countWater(high)).toBeGreaterThan(countWater(low));
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
