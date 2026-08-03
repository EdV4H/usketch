import type { Point, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { clampToShapeEdge, getAnchorPoint } from "../anchor-utils.js";

const style = { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 };

// 100×100 square at origin, center (50, 50).
function square(rotation = 0): ShapeData {
	return { id: "s", type: "rect", x: 0, y: 0, width: 100, height: 100, rotation, style } as ShapeData;
}

function near(a: Point, b: Point, eps = 1e-6) {
	expect(Math.abs(a.x - b.x)).toBeLessThan(eps);
	expect(Math.abs(a.y - b.y)).toBeLessThan(eps);
}

describe("getAnchorPoint rotation", () => {
	it("回転 0 では軸平行の辺の中点を返す", () => {
		near(getAnchorPoint(square(), "top"), { x: 50, y: 0 });
		near(getAnchorPoint(square(), "right"), { x: 100, y: 50 });
		near(getAnchorPoint(square(), "bottom"), { x: 50, y: 100 });
		near(getAnchorPoint(square(), "left"), { x: 0, y: 50 });
	});

	it("90° 回転で各アンカーが中心まわりに回る", () => {
		// top (50,0) rotated 90° CW around (50,50) → (100,50); the cardinal handles cycle.
		near(getAnchorPoint(square(90), "top"), { x: 100, y: 50 });
		near(getAnchorPoint(square(90), "right"), { x: 50, y: 100 });
		near(getAnchorPoint(square(90), "bottom"), { x: 0, y: 50 });
		near(getAnchorPoint(square(90), "left"), { x: 50, y: 0 });
	});

	it("auto アンカーも回転を考慮する（回転した辺上の点を返す）", () => {
		// Target far to the right in world space. For a 90°-rotated square the world
		// "right" side is the shape's local "top" edge.
		const p = getAnchorPoint(square(90), "auto", { x: 1000, y: 50 });
		near(p, { x: 100, y: 50 });
	});
});

describe("clampToShapeEdge rotation", () => {
	it("回転したシェイプの辺に沿ってクランプする", () => {
		// A point outside the 90°-rotated square to the right clamps onto the
		// world-right edge (= the shape's local top edge midpoint region).
		const p = clampToShapeEdge(square(90), { x: 200, y: 50 });
		near(p, { x: 100, y: 50 });
	});

	it("回転 0 では従来通り最近傍の辺に落とす", () => {
		near(clampToShapeEdge(square(), { x: 200, y: 50 }), { x: 100, y: 50 });
		near(clampToShapeEdge(square(), { x: 50, y: -30 }), { x: 50, y: 0 });
	});
});
