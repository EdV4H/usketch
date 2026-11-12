import { describe, expect, it } from "vitest";
import { DEFAULT_GEN, makeFieldShape, normalizeField } from "../elevation-field.js";
import {
	buildTileMesh,
	projectLifted,
	RAMP_WIDTH,
	rampPixels,
	rampRange,
	tileIndices,
	VERTEX_FLOATS,
} from "../elevation-mesh.js";
import { elevationSampler } from "../elevation-model.js";
import { heightColor } from "../elevation-shade.js";

const SIZE = { width: 1280, height: 800 };
const CAM = { pitch: 55, yaw: 0, fov: 600, horizon: 0.45 };

describe("projectLifted", () => {
	it("puts the stage where Chrome draws a Mode 7 tilted layer", () => {
		// Measured in Chrome: the bounding box of the tilted 1280 × 800 `dom-shapes` layer
		// under Mode 7's default camera.
		const pts = [
			[0, 0],
			[1280, 0],
			[0, 800],
			[1280, 800],
		].map(([x, y]) => projectLifted(x, y, 0, CAM, SIZE));
		const xs = pts.map((p) => p?.x ?? Number.NaN);
		const ys = pts.map((p) => p?.y ?? Number.NaN);
		expect(Math.min(...xs)).toBeCloseTo(-962.851, 2);
		expect(Math.min(...ys)).toBeCloseTo(221.556, 2);
		expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(3205.702, 2);
		expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(770.502, 2);
	});

	it("is the identity on a flat view, lifts up the screen when tilted, and is null behind the eye", () => {
		const flat = { ...CAM, pitch: 0 };
		expect(projectLifted(100, 700, 0, flat, SIZE)).toEqual({ x: 100, y: 700, depth: 0 });
		const g = projectLifted(640, 500, 0, CAM, SIZE);
		const up = projectLifted(640, 500, 120, CAM, SIZE);
		expect(up?.y).toBeLessThan(g?.y ?? 0);
		expect(up?.depth).toBeGreaterThan(g?.depth ?? 0);
		expect(projectLifted(640, 360 + 4000, 0, { ...CAM, pitch: 80 }, SIZE)).toBeNull();
	});

	it("draws everything `heightPx` lower when the camera is raised", () => {
		const raised = { ...CAM, heightPx: 120 };
		expect(projectLifted(640, 500, 120, raised, SIZE)).toEqual(
			projectLifted(640, 500, 0, CAM, SIZE),
		);
		expect(projectLifted(300, 200, 200, raised, SIZE)).toEqual(
			projectLifted(300, 200, 80, CAM, SIZE),
		);
	});
});

describe("buildTileMesh", () => {
	const field = normalizeField(makeFieldShape("f", { seed: 3, gen: DEFAULT_GEN, waterLevel: 48 }));
	const sampler = elevationSampler({ field, chunks: new Map() });

	it("has (n+1)² vertices at the tile's samples, with their heights", () => {
		const n = field.chunk;
		const mesh = buildTileMesh(sampler, 0, 2, -1);
		expect(mesh.length).toBe((n + 1) * (n + 1) * VERTEX_FLOATS);
		const v = (li: number, lj: number) =>
			mesh.subarray((lj * (n + 1) + li) * VERTEX_FLOATS, (lj * (n + 1) + li + 1) * VERTEX_FLOATS);
		expect(Array.from(v(0, 0).subarray(0, 2))).toEqual([0, 0]);
		expect(Array.from(v(n, 1).subarray(0, 2))).toEqual([n * field.spacing, field.spacing]);
		expect(v(5, 7)[2]).toBeCloseTo(sampler.sample(2 * n + 5, -n + 7), 4);
		// The last column is the right neighbour's first: tiles meet without a gap.
		expect(v(n, 3)[2]).toBeCloseTo(sampler.sample(3 * n, -n + 3), 4);
	});

	it("samples every 2^level at coarser levels, and water is unshaded", () => {
		const n = field.chunk;
		const mesh = buildTileMesh(sampler, 2, 0, 0);
		expect(mesh[(1 * (n + 1) + 1) * VERTEX_FLOATS]).toBe(4 * field.spacing);
		for (let k = 0; k < mesh.length; k += VERTEX_FLOATS) {
			if (mesh[k + 2] < 48) expect(mesh[k + 3]).toBe(1);
			expect(mesh[k + 3]).toBeGreaterThan(0.5);
		}
	});
});

describe("tileIndices / ramp", () => {
	it("two triangles per cell, all within the grid", () => {
		const idx = tileIndices(4);
		expect(idx.length).toBe(4 * 4 * 6);
		expect(Math.max(...idx)).toBe(5 * 5 - 1);
		expect(tileIndices(4)).toBe(idx); // cached
	});

	it("the ramp is the 2D colours over 0 … relief", () => {
		const field = normalizeField(
			makeFieldShape("f", { seed: 1, gen: DEFAULT_GEN, waterLevel: 48 }),
		);
		expect(rampRange(field)).toBe(DEFAULT_GEN.relief);
		const px = rampPixels(field);
		expect(px.length).toBe(RAMP_WIDTH * 4);
		const k = 300;
		const h = ((k + 0.5) / RAMP_WIDTH) * DEFAULT_GEN.relief;
		const [r, g, b] = heightColor(h, 48, DEFAULT_GEN.relief);
		expect([px[k * 4], px[k * 4 + 1], px[k * 4 + 2]]).toEqual([
			Math.round(r),
			Math.round(g),
			Math.round(b),
		]);
	});
});
