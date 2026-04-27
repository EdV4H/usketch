import { describe, expect, it } from "vitest";
import type { ShapeData } from "../types/shape.js";
import { bidiffShape, diffShape } from "../utils/shape-diff.js";

const baseShape: ShapeData = {
	id: "s1",
	type: "rect",
	x: 0,
	y: 0,
	width: 100,
	height: 100,
	style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
};

describe("diffShape", () => {
	it("同一 shape は空オブジェクト", () => {
		expect(diffShape(baseShape, baseShape)).toEqual({});
		expect(diffShape(baseShape, { ...baseShape })).toEqual({});
	});

	it("x / y のみ変更されたフィールドだけ返す", () => {
		const after: ShapeData = { ...baseShape, x: 50, y: 75 };
		expect(diffShape(baseShape, after)).toEqual({ x: 50, y: 75 });
	});

	it("id / type / style の差異は無視する", () => {
		const after: ShapeData = {
			...baseShape,
			id: "different",
			type: "ellipse",
			style: { fill: "#f00", stroke: "#000", strokeWidth: 1, opacity: 1 },
		};
		expect(diffShape(baseShape, after)).toEqual({});
	});

	it("プラグイン拡張フィールドの差異も検出する", () => {
		// e.g. freedraw points / text content
		const before = { ...baseShape, points: [{ x: 0, y: 0 }] } as ShapeData;
		const after = { ...baseShape, points: [{ x: 1, y: 1 }] } as ShapeData;
		const result = diffShape(before, after);
		expect(result).toHaveProperty("points");
		expect((result as { points: unknown }).points).toEqual([{ x: 1, y: 1 }]);
	});

	it("after にだけある新フィールドも検出する", () => {
		const before = { ...baseShape };
		const after = { ...baseShape, text: "hello" } as ShapeData;
		expect(diffShape(before, after)).toEqual({ text: "hello" });
	});

	it("rotation / zIndex / parentId / meta も diff 対象", () => {
		const before: ShapeData = { ...baseShape, rotation: 0, zIndex: "a0" };
		const after: ShapeData = {
			...baseShape,
			rotation: 90,
			zIndex: "a1",
			parentId: "frame_1",
			meta: { foo: "bar" },
		};
		expect(diffShape(before, after)).toEqual({
			rotation: 90,
			zIndex: "a1",
			parentId: "frame_1",
			meta: { foo: "bar" },
		});
	});
});

describe("bidiffShape", () => {
	it("同一 shape は from / to ともに空", () => {
		expect(bidiffShape(baseShape, baseShape)).toEqual({ from: {}, to: {} });
	});

	it("変わった field のみ from / to に含まれる", () => {
		const after: ShapeData = { ...baseShape, x: 50, width: 200 };
		expect(bidiffShape(baseShape, after)).toEqual({
			from: { x: 0, width: 100 },
			to: { x: 50, width: 200 },
		});
	});

	it("id / type / style の差異は無視する", () => {
		const after: ShapeData = {
			...baseShape,
			type: "ellipse",
			style: { fill: "#f00", stroke: "#000", strokeWidth: 1, opacity: 1 },
		};
		expect(bidiffShape(baseShape, after)).toEqual({ from: {}, to: {} });
	});

	it("undo 用に before の値が from に正しく入る", () => {
		const before: ShapeData = { ...baseShape, rotation: 0 };
		const after: ShapeData = { ...baseShape, rotation: 45 };
		const { from, to } = bidiffShape(before, after);
		expect(from).toEqual({ rotation: 0 });
		expect(to).toEqual({ rotation: 45 });
	});
});
