import { describe, expect, it } from "vitest";
import type { ShapeData } from "../types/shape.js";
import { toLodShape, toLodShapes } from "../utils/lod-shape.js";

function makeShape(overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: "s1",
		type: "rectangle",
		x: 10,
		y: 20,
		width: 100,
		height: 50,
		style: { fill: "#ff0000", stroke: "#000000", strokeWidth: 1, opacity: 1 },
		...overrides,
	};
}

describe("toLodShape", () => {
	it("projects bounds and primary fill/stroke", () => {
		const lod = toLodShape(makeShape());
		expect(lod).toMatchObject({
			id: "s1",
			type: "rectangle",
			x: 10,
			y: 20,
			width: 100,
			height: 50,
			fill: "#ff0000",
			stroke: "#000000",
		});
	});

	it("falls back to a default fill when style.fill is missing", () => {
		const lod = toLodShape(
			makeShape({ style: { fill: "", stroke: "#000", strokeWidth: 1, opacity: 1 } }),
		);
		expect(lod.fill).toBe("#cccccc");
	});

	it("preserves zIndex", () => {
		const lod = toLodShape(makeShape({ zIndex: "a5" }));
		expect(lod.zIndex).toBe("a5");
	});
});

describe("toLodShapes", () => {
	it("maps an array of shapes", () => {
		const shapes = [makeShape({ id: "a" }), makeShape({ id: "b" })];
		const lod = toLodShapes(shapes);
		expect(lod.map((s) => s.id)).toEqual(["a", "b"]);
	});
});
