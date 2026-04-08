import { describe, expect, it } from "vitest";
import type { ShapeData } from "../types/shape.js";
import { computeMinimap } from "../utils/minimap.js";

function makeShape(overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: "s1",
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#ff0000", stroke: "#000000", strokeWidth: 1, opacity: 1 },
		...overrides,
	};
}

describe("computeMinimap", () => {
	it("returns empty result when no shapes and no viewport", () => {
		const r = computeMinimap({ shapes: [] });
		expect(r.rects).toEqual([]);
		expect(r.viewportRect).toBeNull();
	});

	it("projects shape bounds into map space and preserves id + fill", () => {
		const r = computeMinimap({
			shapes: [makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 })],
			mapWidth: 200,
			mapHeight: 200,
			padding: 0,
		});
		expect(r.rects).toHaveLength(1);
		const rect = r.rects[0];
		if (!rect) throw new Error("expected rect");
		expect(rect.id).toBe("a");
		expect(rect.fill).toBe("#ff0000");
		expect(rect.width).toBeGreaterThan(0);
		expect(rect.height).toBeGreaterThan(0);
	});

	it("uses LodShape fallback fill when style.fill is missing", () => {
		const shape = makeShape({
			style: { fill: "", stroke: "#000", strokeWidth: 1, opacity: 1 },
		});
		const r = computeMinimap({ shapes: [shape] });
		const rect = r.rects[0];
		if (!rect) throw new Error("expected rect");
		expect(rect.fill).toBe("#cccccc");
	});

	it("includes viewport rect when viewportWorld is provided", () => {
		const r = computeMinimap({
			shapes: [makeShape()],
			viewportWorld: { x: 0, y: 0, width: 1000, height: 1000 },
		});
		expect(r.viewportRect).not.toBeNull();
	});

	it("enforces minSize so tiny shapes remain visible", () => {
		const r = computeMinimap({
			shapes: [makeShape({ width: 0.01, height: 0.01 })],
			minSize: 3,
		});
		const rect = r.rects[0];
		if (!rect) throw new Error("expected rect");
		expect(rect.width).toBeGreaterThanOrEqual(3);
		expect(rect.height).toBeGreaterThanOrEqual(3);
	});
});
