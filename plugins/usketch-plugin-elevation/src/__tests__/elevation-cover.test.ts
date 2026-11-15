import type { Quad3d } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { COVER_VERTEX_FLOATS, coverLift, coverVertices } from "../elevation-mesh-layer.js";

const lying: Quad3d = { at: [0, 0, 10], u: [64, 0, 0], v: [0, 32, 0] };
const standing: Quad3d = { at: [0, 0, 40], u: [64, 0, 0], v: [0, 0, -40] };

describe("covering the shapes the hills hide", () => {
	it("lifts a lying face to the highest ground under it, a standing one not at all", () => {
		// A bump at (48, 16) rising to 25.
		const ground = (x: number, y: number) => Math.max(0, 25 - Math.hypot(x - 48, y - 16));
		expect(coverLift(lying, ground, 16)).toBeCloseTo(15, 6);
		expect(coverLift(lying, () => 4, 16)).toBe(0);
		expect(coverLift(standing, ground, 16)).toBe(0);
	});

	it("cuts faces into cells and takes a lifted face's depth toward the eye", () => {
		const eye = { x: 0, y: 1000, height: 1010 };
		const v = coverVertices(
			[{ shapeId: "a", quads: [lying] }],
			{ x: 0, y: 0 },
			{
				liftOf: () => 100,
				eye,
			},
		);
		// 64 × 32 in cells of up to 32: 2 × 1 cells, 6 vertices each.
		expect(v.length).toBe(2 * 6 * COVER_VERTEX_FLOATS);
		// The first vertex: drawn at the face's corner, its depth point a tenth of the way to the eye.
		expect([...v.slice(0, 3)]).toEqual([0, 0, 10]);
		expect(v[3]).toBeCloseTo(0, 6);
		expect(v[4]).toBeCloseTo(100, 4);
		expect(v[5]).toBeCloseTo(110, 4);

		const flat = coverVertices([{ shapeId: "a", quads: [lying] }], { x: 10, y: 0 });
		expect([...flat.slice(0, COVER_VERTEX_FLOATS)]).toEqual([-10, 0, 10, -10, 0, 10]);
	});
});
