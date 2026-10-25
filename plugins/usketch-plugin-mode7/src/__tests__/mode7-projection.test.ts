import { describe, expect, it } from "vitest";
import type { Camera } from "../mode7-camera.js";
import { projectToGround, tiltOrigin, unprojectFromGround } from "../mode7-projection.js";

const SIZE = { width: 1200, height: 800 };
const CAM: Camera = { pitch: 55, yaw: 20, fov: 600, horizon: 0.45 };
const FLAT: Camera = { pitch: 0, yaw: 0, fov: 600, horizon: 0.45 };

describe("projectToGround", () => {
	it("is the identity on a flat, unrotated view", () => {
		expect(projectToGround(100, 700, FLAT, SIZE)).toEqual({ x: 100, y: 700, depth: 0, scale: 1 });
	});
	it("keeps the pivot in place", () => {
		const o = tiltOrigin(CAM, SIZE);
		const p = projectToGround(o.x, o.y, CAM, SIZE);
		expect(p?.x).toBeCloseTo(o.x, 9);
		expect(p?.y).toBeCloseTo(o.y, 9);
		expect(p?.scale).toBeCloseTo(1, 9);
	});
	it("enlarges points below the horizon and shrinks points above it", () => {
		const cam = { ...CAM, yaw: 0 };
		const near = projectToGround(600, 700, cam, SIZE);
		const far = projectToGround(600, 100, cam, SIZE);
		expect(near?.scale).toBeGreaterThan(1);
		expect(near?.depth).toBeGreaterThan(0);
		expect(far?.scale).toBeLessThan(1);
	});
	it("returns null behind the eye", () => {
		expect(projectToGround(600, 360 + 2000, { ...CAM, yaw: 0, pitch: 80 }, SIZE)).toBeNull();
	});
});

describe("unprojectFromGround", () => {
	it("inverts projectToGround", () => {
		for (const [x, y] of [
			[0, 0],
			[600, 600],
			[1100, 750],
			[200, 300],
		]) {
			const p = projectToGround(x, y, CAM, SIZE);
			if (!p) throw new Error("expected a projection");
			const back = unprojectFromGround(p.x, p.y, CAM, SIZE);
			expect(back?.x).toBeCloseTo(x, 6);
			expect(back?.y).toBeCloseTo(y, 6);
		}
	});
	it("returns null in the sky above the vanishing line", () => {
		// Vanishing line: py = -fov·cot(pitch) above the pivot.
		const o = tiltOrigin(CAM, SIZE);
		const vanish = o.y - CAM.fov / Math.tan((CAM.pitch * Math.PI) / 180);
		expect(unprojectFromGround(600, vanish - 1, CAM, SIZE)).toBeNull();
	});
});
