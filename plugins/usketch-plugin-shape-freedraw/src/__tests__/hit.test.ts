import type { ShapeStyle } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { eraserHits, hitStroke, maxHalfWidth, strokeBounds } from "../geometry/hit.js";
import type { FreedrawShapeData, PenKind, StrokePoint } from "../types.js";

const style = (strokeWidth: number): ShapeStyle => ({
	fill: "#fff",
	stroke: "#000",
	strokeWidth,
	opacity: 1,
});

function fd(points: StrokePoint[], strokeWidth = 4, pen?: PenKind): FreedrawShapeData {
	return {
		id: "s",
		type: "freedraw",
		x: 0,
		y: 0,
		width: 0,
		height: 0,
		style: style(strokeWidth),
		points,
		pen,
	};
}

describe("hitStroke", () => {
	const shape = fd([
		{ x: 0, y: 0 },
		{ x: 100, y: 0 },
	]);
	it("線の近くは true", () => {
		expect(hitStroke(shape, { x: 50, y: 1 })).toBe(true);
	});
	it("線から遠いと false", () => {
		expect(hitStroke(shape, { x: 50, y: 40 })).toBe(false);
	});
	it("1点は円判定", () => {
		const dot = fd([{ x: 10, y: 10 }], 20);
		expect(hitStroke(dot, { x: 12, y: 12 })).toBe(true);
		expect(hitStroke(dot, { x: 40, y: 40 })).toBe(false);
	});
});

describe("strokeBounds", () => {
	it("最大半幅ぶん padding する", () => {
		const b = strokeBounds(
			fd(
				[
					{ x: 0, y: 0 },
					{ x: 10, y: 0 },
				],
				4,
			),
		);
		expect(b.x).toBe(-2);
		expect(b.width).toBe(14);
	});
});

describe("maxHalfWidth", () => {
	it("筆ペンは size×1.55/2", () => {
		expect(maxHalfWidth(fd([{ x: 0, y: 0 }], 10, "brush"))).toBeCloseTo((10 * 1.55) / 2);
	});
	it("一定幅は size/2", () => {
		expect(maxHalfWidth(fd([{ x: 0, y: 0 }], 10, "felt"))).toBe(5);
	});
});

describe("eraserHits", () => {
	const shape = fd(
		[
			{ x: 0, y: 0 },
			{ x: 50, y: 0 },
		],
		4,
	);
	it("点が消しゴム円内なら true", () => {
		expect(eraserHits(shape, { x: 50, y: 3 }, 6)).toBe(true);
	});
	it("どの点も外なら false", () => {
		expect(eraserHits(shape, { x: 25, y: 100 }, 6)).toBe(false);
	});
});
