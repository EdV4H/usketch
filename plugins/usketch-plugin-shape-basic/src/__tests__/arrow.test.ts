import { DEFAULT_STYLE } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	type ArrowDirection,
	createDefaultArrow,
	flipArrow,
	getArrowDirection,
	getArrowPoints,
} from "../shapes/arrow.js";
import type { ArrowShapeData } from "../types.js";

function arrow(overrides: Partial<ArrowShapeData> = {}): ArrowShapeData {
	return {
		id: "a",
		type: "arrow",
		x: 0,
		y: 0,
		width: 120,
		height: 60,
		style: { ...DEFAULT_STYLE },
		...overrides,
	};
}

describe("getArrowPoints", () => {
	it("keeps the legacy shape at the default 120x60 size (no direction = right)", () => {
		expect(getArrowPoints(arrow())).toEqual([
			{ x: 0, y: 18 },
			{ x: 72, y: 18 },
			{ x: 72, y: 0 },
			{ x: 120, y: 30 },
			{ x: 72, y: 60 },
			{ x: 72, y: 42 },
			{ x: 0, y: 42 },
		]);
	});

	it("stretching the length moves only the shaft end; head size follows the thickness", () => {
		const pts = getArrowPoints(arrow({ width: 300 }));
		// Head length stays 0.8 * height = 48.
		expect(pts[1]).toEqual({ x: 252, y: 18 });
		expect(pts[3]).toEqual({ x: 300, y: 30 });
		expect(pts[0]).toEqual({ x: 0, y: 18 });
	});

	it("clamps the head length to the arrow length when very short", () => {
		const pts = getArrowPoints(arrow({ width: 20 }));
		expect(pts[1]).toEqual({ x: 0, y: 18 });
		expect(pts[3]).toEqual({ x: 20, y: 30 });
	});

	it("points left by mirroring horizontally", () => {
		const pts = getArrowPoints(arrow({ direction: "left" }));
		expect(pts[3]).toEqual({ x: 0, y: 30 });
		expect(pts[1]).toEqual({ x: 48, y: 18 });
		expect(pts[0]).toEqual({ x: 120, y: 18 });
	});

	it("points down using width as the thickness", () => {
		const pts = getArrowPoints(arrow({ direction: "down", width: 60, height: 200 }));
		expect(pts[3]).toEqual({ x: 30, y: 200 });
		expect(pts[1]).toEqual({ x: 18, y: 152 });
		expect(pts[0]).toEqual({ x: 18, y: 0 });
	});

	it("points up using width as the thickness", () => {
		const pts = getArrowPoints(arrow({ direction: "up", x: 10, y: 10, width: 60, height: 200 }));
		expect(pts[3]).toEqual({ x: 40, y: 10 });
		expect(pts[1]).toEqual({ x: 28, y: 58 });
		expect(pts[0]).toEqual({ x: 28, y: 210 });
	});
});

describe("getArrowDirection", () => {
	it.each<[number, number, ArrowDirection]>([
		[100, 10, "right"],
		[-100, 10, "left"],
		[10, 100, "down"],
		[10, -100, "up"],
		[50, -50, "right"],
		[-50, 50, "left"],
		[0, 0, "right"],
	])("drag (%d, %d) -> %s", (dx, dy, expected) => {
		expect(getArrowDirection(dx, dy)).toBe(expected);
	});
});

describe("flipArrow", () => {
	it("reverses a horizontal arrow on a horizontal flip only", () => {
		expect(flipArrow(arrow(), { x: true, y: false })).toEqual({ direction: "left" });
		expect(flipArrow(arrow({ direction: "left" }), { x: true, y: false })).toEqual({
			direction: "right",
		});
		expect(flipArrow(arrow(), { x: false, y: true })).toEqual({});
	});

	it("reverses a vertical arrow on a vertical flip only", () => {
		expect(flipArrow(arrow({ direction: "up" }), { x: false, y: true })).toEqual({
			direction: "down",
		});
		expect(flipArrow(arrow({ direction: "down" }), { x: true, y: false })).toEqual({});
	});
});

describe("createDefaultArrow", () => {
	it("defaults to pointing right", () => {
		expect((createDefaultArrow({ id: "a", x: 0, y: 0 }) as ArrowShapeData).direction).toBe("right");
	});
});
