import { describe, expect, it } from "vitest";
import { visibleCellRange } from "../map-layer.js";

const rect = (left: number, top: number, right: number, bottom: number): DOMRectReadOnly =>
	({
		left,
		top,
		right,
		bottom,
		x: left,
		y: top,
		width: right - left,
		height: bottom - top,
		toJSON() {},
	}) as unknown as DOMRectReadOnly;

describe("visibleCellRange", () => {
	it("returns null when the viewport is unknown", () => {
		expect(visibleCellRange(null, 40)).toBeNull();
	});

	it("excludes a cell when the (exclusive) edge lands exactly on a tile boundary", () => {
		// right=80, tile=40 → cells 0,1 overlap [0,80); cell 2 starts at 80 → excluded.
		expect(visibleCellRange(rect(0, 0, 80, 40), 40)).toEqual({ c0: 0, c1: 1, r0: 0, r1: 0 });
	});

	it("includes a partially-covered cell just past a boundary", () => {
		expect(visibleCellRange(rect(0, 0, 81, 40), 40)).toEqual({ c0: 0, c1: 2, r0: 0, r1: 0 });
	});
});
