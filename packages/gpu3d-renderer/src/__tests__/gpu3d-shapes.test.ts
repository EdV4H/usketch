import type { ShapeData, ShapeView3d } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { shape3dGeometry } from "../gpu3d-shapes.js";

const shape = (extra: Partial<ShapeData> = {}): ShapeData =>
	({ id: "a", type: "rect", x: 0, y: 0, width: 40, height: 20, style: {}, ...extra }) as ShapeData;
const params = (p: Partial<ShapeView3d>): ShapeView3d => ({
	mode: "stand",
	height: 0,
	facing: "fixed",
	ground: true,
	shadow: true,
	collision: "none",
	...p,
});
const view = { amount: 1, yaw: 0, viewportRotation: 0, groundHeight: 10, pad: 0 };
const close = (a: number[], b: number[]) => {
	for (const [i, v] of a.entries()) expect(v).toBeCloseTo(b[i], 6);
};

describe("shape3dGeometry", () => {
	it("stands a shape up about its foot, on the ground, with a shadow", () => {
		const g = shape3dGeometry(shape(), params({ mode: "stand" }), view);
		// Foot (20, 20) at height 10; the picture's top-left is up 20 from its left end.
		close(g.picture.at, [0, 20, 30]);
		close(g.picture.u, [40, 0, 0]);
		close(g.picture.v, [0, 0, -20]);
		expect(g.flat).toBe(false);
		expect(g.shadow?.opacity).toBe(1);
		close(g.shadow?.quad.at ?? [], [20 - 18, 20 - 3, 10]);
	});

	it("lies flat at amount 0, half-folded half-way", () => {
		const flat = shape3dGeometry(shape(), params({ mode: "stand" }), { ...view, amount: 0 });
		close(flat.picture.at, [0, 0, 10]);
		close(flat.picture.v, [0, 20, 0]);
		expect(flat.shadow).toBeNull();
		const half = shape3dGeometry(shape(), params({ mode: "stand" }), { ...view, amount: 0.5 });
		const c = Math.SQRT1_2 * 20;
		close(half.picture.at, [0, 20 - c, 10 + c]);
	});

	it("turns a camera-facing shape against the yaw, back into the world's frame", () => {
		const g = shape3dGeometry(shape(), params({ mode: "stand", facing: "camera" }), {
			...view,
			yaw: 90,
			viewportRotation: 30,
		});
		// Screen heading -90, world -120.
		const rad = (-120 * Math.PI) / 180;
		close(g.picture.u, [40 * Math.cos(rad), 40 * Math.sin(rad), 0]);
	});

	it("raises a box's top on four shaded walls, without ground when not asked", () => {
		const g = shape3dGeometry(shape(), params({ mode: "box", height: 30, ground: false }), view);
		close(g.picture.at, [0, 0, 30]);
		expect(g.walls.map((w) => w.shade)).toEqual([0.22, 0.35, 0.22, 0.35]);
		close(g.walls[0].quad.at, [0, 0, 30]);
		close(g.walls[0].quad.u, [40, 0, 0]);
		close(g.walls[0].quad.v, [0, 0, -30]);
		expect(g.shadow).toBeNull();
		expect(
			shape3dGeometry(shape(), params({ mode: "box", height: 30 }), { ...view, amount: 0 }).flat,
		).toBe(true);
	});

	it("lifts a float face with a shadow under it, padded", () => {
		const g = shape3dGeometry(shape(), params({ mode: "float", height: 50 }), { ...view, pad: 2 });
		close(g.picture.at, [-2, -2, 60]);
		close(g.picture.u, [44, 0, 0]);
		expect(g.shadow?.opacity).toBeCloseTo(0.7);
		close(g.shadow?.quad.at ?? [], [20 - 18, 10 - 9, 10]);
		// Height 0 (a ground-flat shape): lies flat, no shadow.
		const ground = shape3dGeometry(shape(), params({ mode: "float", height: 0 }), view);
		expect(ground.flat).toBe(true);
		expect(ground.shadow).toBeNull();
	});
});
