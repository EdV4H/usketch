import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	areaContains,
	buildColliderIndex,
	colliderFor,
	STAND_WALL_THICKNESS,
	solidHeightAt,
} from "../shape-3d-collision.js";
import { DEFAULT_SHAPE_3D_TYPES, normalizeShape3d, SHAPE_3D_KEY } from "../shape-3d-params.js";

const shape = (id: string, x: number, y: number, w: number, h: number, p: object, rotation = 0) =>
	({
		id,
		type: "rectangle",
		x,
		y,
		width: w,
		height: h,
		rotation,
		style: {},
		[SHAPE_3D_KEY]: p,
	}) as unknown as ShapeData;

const params = (p: object) => {
	const n = normalizeShape3d(p);
	if (!n) throw new Error("bad params");
	return n;
};

const flat = () => 0;
const index = (...shapes: ShapeData[]) => buildColliderIndex(shapes, DEFAULT_SHAPE_3D_TYPES);

describe("colliderFor", () => {
	it("is null without a collision, or for a floating shape", () => {
		const s = shape("a", 0, 0, 100, 50, { mode: "box" });
		expect(colliderFor(s, params({ mode: "box" }))).toBeNull();
		expect(colliderFor(s, params({ mode: "float", collision: "solid" }))).toBeNull();
	});
	it("covers a box's whole rectangle, turned with it", () => {
		const s = shape("a", 0, 0, 100, 20, { mode: "box" }, 90);
		const c = colliderFor(s, params({ mode: "box", collision: "solid" }));
		if (!c) throw new Error("no collider");
		// Turned 90°: the 100 × 20 box now spans 20 across and 100 down, about (50, 10).
		expect(areaContains(c.area, 50, 10 + 45)).toBe(true);
		expect(areaContains(c.area, 50 + 45, 10)).toBe(false);
		expect(c.minX).toBeCloseTo(40);
		expect(c.maxY).toBeCloseTo(60);
	});
	it("gives a fixed stood-up shape a thin wall along its bottom edge", () => {
		const s = shape("a", 0, 0, 100, 60, { mode: "stand" });
		const c = colliderFor(s, params({ mode: "stand", facing: "fixed", collision: "solid" }));
		if (!c) throw new Error("no collider");
		expect(areaContains(c.area, 50, 60)).toBe(true);
		expect(areaContains(c.area, 5, 60 + STAND_WALL_THICKNESS / 2 - 0.1)).toBe(true);
		expect(areaContains(c.area, 50, 30)).toBe(false); // the shape's face lies flat no more
	});
	it("gives a camera-facing stood-up shape a disc at its foot", () => {
		const s = shape("a", 0, 0, 100, 60, { mode: "stand" });
		const c = colliderFor(s, params({ mode: "stand", collision: "solid" }));
		expect(c?.area.kind).toBe("circle");
		expect(c?.area).toMatchObject({ cx: 50, cy: 60, r: 25 });
	});
});

describe("solidHeightAt", () => {
	it("is null where nothing stands", () => {
		expect(solidHeightAt(index(), 0, 0, flat)).toBeNull();
		const idx = index(shape("a", 0, 0, 100, 100, { mode: "box", collision: "solid" }));
		expect(solidHeightAt(idx, 500, 500, flat)).toBeNull();
		expect(solidHeightAt(idx, Number.NaN, 0, flat)).toBeNull();
	});
	it("is Infinity in a wall and a platform's top on it", () => {
		const idx = index(
			shape("wall", 0, 0, 100, 100, { mode: "box", collision: "solid" }),
			shape("deck", 200, 0, 100, 100, { mode: "box", height: 30, collision: "platform" }),
		);
		expect(solidHeightAt(idx, 50, 50, flat)).toBe(Number.POSITIVE_INFINITY);
		expect(solidHeightAt(idx, 250, 50, flat)).toBe(30);
	});
	it("puts a grounded platform on the terrain under its centre", () => {
		const idx = index(
			shape("on", 0, 0, 100, 100, { mode: "box", height: 30, collision: "platform" }),
			shape("off", 200, 0, 100, 100, {
				mode: "box",
				height: 30,
				collision: "platform",
				ground: false,
			}),
		);
		const terrain = () => 40;
		expect(solidHeightAt(idx, 10, 10, terrain)).toBe(70);
		expect(solidHeightAt(idx, 210, 10, terrain)).toBe(30);
	});
	it("takes the highest platform and lets a wall win", () => {
		const idx = index(
			shape("low", 0, 0, 100, 100, { mode: "box", height: 10, collision: "platform" }),
			shape("high", 50, 0, 100, 100, { mode: "box", height: 50, collision: "platform" }),
			shape("wall", 90, 0, 100, 100, { mode: "box", collision: "solid" }),
		);
		expect(solidHeightAt(idx, 20, 20, flat)).toBe(10);
		expect(solidHeightAt(idx, 70, 20, flat)).toBe(50);
		expect(solidHeightAt(idx, 95, 20, flat)).toBe(Number.POSITIVE_INFINITY);
	});
	it("finds shapes across grid cells and very large ones", () => {
		const idx = index(
			shape("edge", 250, 250, 20, 20, { mode: "box", collision: "solid" }),
			shape("huge", -20000, -20000, 40000, 40000, {
				mode: "box",
				height: 5,
				collision: "platform",
			}),
		);
		expect(idx.large).toHaveLength(1);
		expect(solidHeightAt(idx, 255, 255, flat)).toBe(Number.POSITIVE_INFINITY);
		expect(solidHeightAt(idx, 265, 265, flat)).toBe(Number.POSITIVE_INFINITY);
		expect(solidHeightAt(idx, 9000, -9000, flat)).toBe(5);
	});
	it("skips types that may not use the mode", () => {
		const s = { ...shape("e", 0, 0, 100, 100, { mode: "box", collision: "solid" }), type: "embed" };
		expect(solidHeightAt(index(s as ShapeData), 50, 50, flat)).toBeNull();
	});
});
