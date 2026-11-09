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
	it("lifts a point by z like a depth layer's translateZ (the CSS matrices, multiplied out)", () => {
		// perspective(fov) · rotateX(pitch) · rotateZ(yaw) · translateZ(z), about the origin.
		const css = (x: number, y: number, z: number, cam: Camera) => {
			const o = tiltOrigin(cam, SIZE);
			const r = (d: number) => (d * Math.PI) / 180;
			let p = [x - o.x, y - o.y, z];
			const [cz, sz] = [Math.cos(r(cam.yaw)), Math.sin(r(cam.yaw))];
			p = [p[0] * cz - p[1] * sz, p[0] * sz + p[1] * cz, p[2]];
			const [cx, sx] = [Math.cos(r(cam.pitch)), Math.sin(r(cam.pitch))];
			p = [p[0], p[1] * cx - p[2] * sx, p[1] * sx + p[2] * cx];
			const w = 1 - p[2] / cam.fov; // perspective(d): w = 1 − z/d
			return { x: o.x + p[0] / w, y: o.y + p[1] / w };
		};
		for (const [x, y, z] of [
			[300, 500, 0],
			[300, 500, 80],
			[900, 200, 240],
			[50, 760, 10],
		]) {
			const p = projectToGround(x, y, CAM, SIZE, z);
			const c = css(x, y, z, CAM);
			expect(p?.x).toBeCloseTo(c.x, 6);
			expect(p?.y).toBeCloseTo(c.y, 6);
		}
		// Up on screen when tilted back.
		const ground = projectToGround(600, 500, { ...CAM, yaw: 0 }, SIZE);
		const lifted = projectToGround(600, 500, { ...CAM, yaw: 0 }, SIZE, 100);
		expect(lifted?.y).toBeLessThan(ground?.y ?? 0);
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
