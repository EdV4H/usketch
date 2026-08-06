import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { gridPositions, makeAspectResize, rectHitTest } from "../geometry.js";

describe("gridPositions", () => {
	const opts = { stepX: 10, stepY: 20, originX: 100, originY: 200 };

	it("lays out a single row when cols >= count", () => {
		const pos = gridPositions(3, { ...opts, cols: 3 });
		expect(pos).toEqual([
			{ x: 100, y: 200 },
			{ x: 110, y: 200 },
			{ x: 120, y: 200 },
		]);
	});

	it("wraps to the next row when count exceeds cols", () => {
		const pos = gridPositions(5, { ...opts, cols: 2 });
		expect(pos).toEqual([
			{ x: 100, y: 200 }, // row 0
			{ x: 110, y: 200 },
			{ x: 100, y: 220 }, // row 1
			{ x: 110, y: 220 },
			{ x: 100, y: 240 }, // row 2
		]);
	});

	it("returns an empty array for count 0", () => {
		expect(gridPositions(0, { ...opts, cols: 3 })).toEqual([]);
	});

	it("treats cols < 1 as a single column", () => {
		const pos = gridPositions(2, { ...opts, cols: 0 });
		expect(pos).toEqual([
			{ x: 100, y: 200 },
			{ x: 100, y: 220 },
		]);
	});
});

const base: ShapeData = {
	id: "c1",
	type: "card",
	x: 100,
	y: 100,
	width: 120,
	height: 160, // aspect 0.75
	style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
};

const resize = makeAspectResize(() => 120 / 160);

describe("makeAspectResize", () => {
	it("keeps aspect ratio when dragging a corner", () => {
		const out = resize(base, "se", { x: 60, y: 0 });
		// width grows by 60 → height derived from aspect, ratio preserved
		expect(out.width / out.height).toBeCloseTo(120 / 160, 5);
		expect(out.width).toBeCloseTo(180, 5);
		expect(out.height).toBeCloseTo(240, 5);
	});

	it("anchors the opposite corner (nw keeps bottom-right fixed)", () => {
		const out = resize(base, "nw", { x: -30, y: 0 });
		expect(out.x + out.width).toBeCloseTo(base.x + base.width, 5);
		expect(out.y + out.height).toBeCloseTo(base.y + base.height, 5);
		expect(out.width / out.height).toBeCloseTo(120 / 160, 5);
	});

	it("clamps to a minimum size while preserving aspect", () => {
		const out = resize(base, "se", { x: -1000, y: -1000 });
		expect(out.width).toBeGreaterThanOrEqual(60);
		expect(out.width / out.height).toBeCloseTo(120 / 160, 5);
	});
});

describe("rectHitTest", () => {
	it("hits inside the rect", () => {
		expect(rectHitTest(base, { x: 150, y: 150 })).toBe(true);
	});
	it("misses outside the rect", () => {
		expect(rectHitTest(base, { x: 10, y: 10 })).toBe(false);
	});
});
