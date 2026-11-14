import { createCommandRegistry } from "@edv4h/usketch-core";
import { describe, expect, it } from "vitest";
import { gradeProfile, resamplePath } from "../elevation-grade.js";
import { elevationHeightAt } from "../elevation-model.js";
import { enableInfiniteElevation, gradeElevation } from "../elevation-ops.js";
import { fakeStore } from "./helpers.js";

function setup() {
	const store = fakeStore();
	const commands = createCommandRegistry();
	return { store, commands, deps: { store, commands } };
}

const line = [
	{ x: 0, y: 0 },
	{ x: 2000, y: 0 },
];

describe("resamplePath", () => {
	it("puts a point every step and keeps both ends", () => {
		const pts = resamplePath(
			[
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
			],
			16,
		);
		expect(pts.map((p) => p.x)).toEqual([0, 16, 32, 48, 50]);
	});

	it("carries the spacing across corners", () => {
		const pts = resamplePath(
			[
				{ x: 0, y: 0 },
				{ x: 10, y: 0 },
				{ x: 10, y: 10 },
			],
			8,
		);
		expect(pts[1]).toEqual({ x: 8, y: 0 });
		expect(pts[2]).toEqual({ x: 10, y: 6 });
	});
});

describe("gradeProfile", () => {
	const bumpy = (x: number) => (Math.round(x / 16) % 2 === 0 ? 100 : 0);

	it("averages the ground along the path (bumps go, the mean stays)", () => {
		const p = gradeProfile(line, (x) => bumpy(x), { step: 16, smoothing: 320 });
		const mid = p[Math.floor(p.length / 2)];
		expect(mid.h).toBeGreaterThan(40);
		expect(mid.h).toBeLessThan(60);
	});

	it("follows a slope", () => {
		const p = gradeProfile(line, (x) => x / 10, { step: 16, smoothing: 160 });
		const mid = p[Math.floor(p.length / 2)];
		expect(mid.h).toBeCloseTo(mid.x / 10, 0);
	});

	it("uses one height when given", () => {
		const p = gradeProfile(line, (x) => x, { step: 16, smoothing: 160, height: 42 });
		expect(new Set(p.map((q) => q.h))).toEqual(new Set([42]));
	});

	it("wraps the average around a loop, so its seam has no step", () => {
		const loop = [
			{ x: 0, y: 0 },
			{ x: 800, y: 0 },
			{ x: 800, y: 800 },
			{ x: 0, y: 800 },
			{ x: 0, y: 0 },
		];
		const p = gradeProfile(loop, (x, y) => (x < 100 && y < 100 ? 200 : 0), {
			step: 16,
			smoothing: 320,
			closed: true,
		});
		expect(p[0].h).toBeCloseTo(p[p.length - 1].h, 6);
		expect(Math.abs(p[1].h - p[p.length - 2].h)).toBeLessThan(10);
	});

	it("closes a loop given without repeating its first point", () => {
		const square = [
			{ x: 0, y: 0 },
			{ x: 800, y: 0 },
			{ x: 800, y: 800 },
			{ x: 0, y: 800 },
		];
		const p = gradeProfile(square, () => 0, { step: 16, smoothing: 0, closed: true });
		expect(p[p.length - 1]).toMatchObject({ x: 0, y: 0 });
		expect(p.some((q) => q.x === 0 && q.y === 400)).toBe(true);
	});
});

describe("gradeElevation", () => {
	it("does nothing on a board without a field", () => {
		const { store, deps } = setup();
		expect(gradeElevation(deps, line, { halfWidth: 100 })).toBe(0);
		expect(store.getShapes().size).toBe(0);
	});

	it("levels the strip across, in one undo step", () => {
		const { store, commands, deps } = setup();
		enableInfiniteElevation(deps, { seed: 3, gen: { relief: 1200, scale: 2048 } });
		const before = [-80, 0, 80].map((y) => elevationHeightAt(store, 1000, y));
		const far = elevationHeightAt(store, 1000, 600);
		const n = gradeElevation(deps, line, { halfWidth: 100, height: 300 });
		expect(n).toBeGreaterThan(0);
		for (const y of [-80, 0, 80]) expect(elevationHeightAt(store, 1000, y)).toBeCloseTo(300, 0);
		// Far past the shoulder the ground is untouched.
		expect(elevationHeightAt(store, 1000, 600)).toBe(far);
		commands.undo();
		expect([-80, 0, 80].map((y) => elevationHeightAt(store, 1000, y))).toEqual(before);
	});

	it("following the ground keeps the strip flat across but sloped along", () => {
		const { store, deps } = setup();
		enableInfiniteElevation(deps, { seed: 5, gen: { relief: 1200, scale: 2048 } });
		gradeElevation(deps, line, { halfWidth: 120 });
		for (const x of [400, 1000, 1600]) {
			const across = [-80, 0, 80].map((y) => elevationHeightAt(store, x, y));
			expect(Math.max(...across) - Math.min(...across)).toBeLessThan(1);
		}
	});

	it("blends into the ground over the shoulder", () => {
		const { store, deps } = setup();
		enableInfiniteElevation(deps, { seed: 3, gen: { relief: 1200, scale: 2048 } });
		const ground = elevationHeightAt(store, 1000, 150);
		gradeElevation(deps, line, { halfWidth: 100, shoulder: 100, height: 2000 });
		const mid = elevationHeightAt(store, 1000, 150);
		expect(mid).toBeGreaterThan(ground);
		expect(mid).toBeLessThan(2000);
	});

	it("rejects bad options, with or without a field", () => {
		const { deps } = setup();
		expect(() => gradeElevation(deps, line, { halfWidth: -5 })).toThrow(RangeError);
		enableInfiniteElevation(deps, { seed: 3 });
		expect(() => gradeElevation(deps, line, { halfWidth: 50000 })).toThrow(RangeError);
		expect(() => gradeElevation(deps, line, { halfWidth: 10, height: 5000 })).toThrow(RangeError);
		expect(() => gradeElevation(deps, line, { halfWidth: 0 })).toThrow(RangeError);
		expect(() => gradeElevation(deps, line, { halfWidth: 10, shoulder: -1 })).toThrow(RangeError);
		expect(() => gradeElevation(deps, line, { halfWidth: 10, height: Number.NaN })).toThrow(
			RangeError,
		);
	});
});
