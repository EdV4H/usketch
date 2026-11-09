import { describe, expect, it } from "vitest";
import { makeFieldShape, normalizeField } from "../elevation-field.js";
import {
	MAX_TILES,
	MIN_TILE_PX,
	planTiles,
	tileBitmapPx,
	tileWorldSize,
} from "../elevation-tiles.js";

const field = normalizeField(makeFieldShape("f"));
const rect = (w: number, h: number) => ({ left: 0, top: 0, right: w, bottom: h });

describe("planTiles", () => {
	it("draws chunks as they are when they are big enough on screen", () => {
		const plan = planTiles(field, rect(1920, 1080), 1);
		expect(plan).toMatchObject({
			level: 0,
			worldSize: 512,
			tx0: 0,
			tx1: 3,
			ty0: 0,
			ty1: 2,
			px: 512,
		});
	});

	it("goes up a level as the view zooms out, keeping tiles at least MIN_TILE_PX wide", () => {
		for (const zoom of [0.5, 0.2, 0.05, 0.01]) {
			const plan = planTiles(field, rect(1920 / zoom, 1080 / zoom), zoom);
			expect(plan).not.toBeNull();
			if (!plan) continue;
			expect(plan.worldSize * zoom).toBeGreaterThanOrEqual(MIN_TILE_PX);
			expect(plan.worldSize).toBe(tileWorldSize(field, plan.level));
			expect((plan.tx1 - plan.tx0 + 1) * (plan.ty1 - plan.ty0 + 1)).toBeLessThanOrEqual(MAX_TILES);
		}
	});

	it("raises the level further when a huge area (3D overscan) would need too many tiles", () => {
		const plan = planTiles(field, rect(40000, 40000), 1);
		expect(plan && (plan.tx1 - plan.tx0 + 1) * (plan.ty1 - plan.ty0 + 1)).toBeLessThanOrEqual(
			MAX_TILES,
		);
		expect(plan?.level).toBeGreaterThan(0);
	});

	it("is null for an empty or broken rect", () => {
		expect(planTiles(field, rect(0, 100), 1)).toBeNull();
		expect(planTiles(field, { left: Number.NaN, top: 0, right: 1, bottom: 1 }, 1)).toBeNull();
		expect(planTiles(field, rect(100, 100), 0)).toBeNull();
	});
});

describe("tileBitmapPx", () => {
	it("is enough pixels for the tile's size on screen", () => {
		expect(tileBitmapPx(50)).toBe(64);
		expect(tileBitmapPx(200)).toBe(256);
		expect(tileBitmapPx(512)).toBe(512);
		expect(tileBitmapPx(5000)).toBe(512);
	});
});
