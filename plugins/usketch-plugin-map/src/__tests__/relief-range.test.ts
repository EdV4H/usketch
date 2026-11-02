import { describe, expect, it } from "vitest";
import { reliefCellRange } from "../map-relief-layer.js";

// Ground: chunks x 0..1 (cells 0..31), y 0..0 (cells 0..15).
const ground = { cx0: 0, cx1: 1, cy0: 0, cy1: 0 };

describe("reliefCellRange", () => {
	it("covers the view in steps of 4 cells, kept 2 cells inside the ground by default", () => {
		expect(reliefCellRange(ground, { c0: 5, c1: 20, r0: 2, r1: 30 })).toEqual({
			c0: 6, // floor(5/4)*4 + 2
			c1: 21, // ceil(21/4)*4 - 1 - 2
			r0: 2, // the ground's first cell + 2
			r1: 13, // the ground's last cell (15) - 2
		});
	});
	it("takes the edge inset as a parameter", () => {
		expect(reliefCellRange(ground, { c0: 5, c1: 20, r0: 2, r1: 30 }, 0)).toEqual({
			c0: 4,
			c1: 23,
			r0: 0,
			r1: 15,
		});
		expect(reliefCellRange(ground, { c0: 5, c1: 20, r0: 2, r1: 30 }, 4)).toEqual({
			c0: 8,
			c1: 19,
			r0: 4,
			r1: 11,
		});
	});
	it("uses the default inset for junk values", () => {
		const view = { c0: 5, c1: 20, r0: 2, r1: 30 };
		expect(reliefCellRange(ground, view, -1)).toEqual(reliefCellRange(ground, view));
		expect(reliefCellRange(ground, view, Number.NaN)).toEqual(reliefCellRange(ground, view));
	});
	it("reaches the ground's edge chunks when the view covers the whole ground", () => {
		// A view as large as the ground (the relief following the overscanned ground).
		expect(reliefCellRange(ground, { c0: 0, c1: 31, r0: 0, r1: 15 })).toEqual({
			c0: 2,
			c1: 29,
			r0: 2,
			r1: 13,
		});
	});
});
