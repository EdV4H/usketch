import { describe, expect, it } from "vitest";
import type { ShapeData } from "../../types/shape.js";
import {
	getShapeAABB,
	isShapeOutsideViewport,
	rectsIntersect,
	scaleRectAboutCenter,
} from "../viewport-lod.js";

function shape(overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: "s",
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...overrides,
	};
}

describe("getShapeAABB", () => {
	it("returns raw bounds when unrotated", () => {
		expect(getShapeAABB(shape({ x: 10, y: 20, width: 30, height: 40 }))).toEqual({
			x: 10,
			y: 20,
			width: 30,
			height: 40,
		});
	});

	it("expands to the rotated AABB when rotated", () => {
		// A 100x100 square rotated 45° around its center grows to ~141.42 per side.
		const aabb = getShapeAABB(shape({ x: 0, y: 0, width: 100, height: 100, rotation: 45 }));
		expect(aabb.width).toBeCloseTo(Math.SQRT2 * 100, 3);
		expect(aabb.height).toBeCloseTo(Math.SQRT2 * 100, 3);
		// Center stays at (50,50).
		expect(aabb.x + aabb.width / 2).toBeCloseTo(50, 6);
		expect(aabb.y + aabb.height / 2).toBeCloseTo(50, 6);
	});
});

describe("rectsIntersect", () => {
	const a = { x: 0, y: 0, width: 100, height: 100 };
	it("true when overlapping", () => {
		expect(rectsIntersect(a, { x: 50, y: 50, width: 100, height: 100 })).toBe(true);
	});
	it("false when disjoint", () => {
		expect(rectsIntersect(a, { x: 200, y: 0, width: 50, height: 50 })).toBe(false);
	});
	it("false when only edges touch", () => {
		expect(rectsIntersect(a, { x: 100, y: 0, width: 50, height: 50 })).toBe(false);
	});
});

describe("scaleRectAboutCenter", () => {
	const r = { x: 0, y: 0, width: 100, height: 100 };
	it("grows about the center for ratio > 1", () => {
		expect(scaleRectAboutCenter(r, 1.2)).toEqual({ x: -10, y: -10, width: 120, height: 120 });
	});
	it("shrinks about the center for ratio < 1", () => {
		expect(scaleRectAboutCenter(r, 0.5)).toEqual({ x: 25, y: 25, width: 50, height: 50 });
	});
	it("keeps the center fixed", () => {
		const s = scaleRectAboutCenter({ x: 10, y: 20, width: 40, height: 60 }, 2);
		expect(s.x + s.width / 2).toBe(30);
		expect(s.y + s.height / 2).toBe(50);
	});
});

describe("isShapeOutsideViewport", () => {
	const viewport = { x: 0, y: 0, width: 1000, height: 1000 };

	it("in-view shape is not outside (ratio 1)", () => {
		expect(isShapeOutsideViewport(shape({ x: 400, y: 400 }), viewport, 1)).toBe(false);
	});

	it("far-off shape is outside (ratio 1)", () => {
		expect(isShapeOutsideViewport(shape({ x: 5000, y: 5000 }), viewport, 1)).toBe(true);
	});

	it("ratio 1.2 keeps a just-outside shape full-detail (buffer)", () => {
		// Shape at x=1050 is outside the 0..1000 viewport but inside the 120% region
		// (-100..1100).
		const s = shape({ x: 1050, y: 400, width: 20, height: 20 });
		expect(isShapeOutsideViewport(s, viewport, 1)).toBe(true);
		expect(isShapeOutsideViewport(s, viewport, 1.2)).toBe(false);
	});

	it("ratio 0.5 makes an in-view edge shape LOD", () => {
		// Central 50% region is 250..750. A shape near the right edge (x=900) is in
		// the viewport but outside the shrunken region.
		const s = shape({ x: 900, y: 400, width: 20, height: 20 });
		expect(isShapeOutsideViewport(s, viewport, 1)).toBe(false);
		expect(isShapeOutsideViewport(s, viewport, 0.5)).toBe(true);
	});

	it("returns false (full detail) when viewportBounds has no size", () => {
		expect(
			isShapeOutsideViewport(shape({ x: 9999, y: 9999 }), { x: 0, y: 0, width: 0, height: 0 }, 1),
		).toBe(false);
	});
});
