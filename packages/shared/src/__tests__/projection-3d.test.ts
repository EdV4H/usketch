import { describe, expect, it } from "vitest";
import {
	type ProjectionCamera,
	projectStagePoint,
	projectWorld,
	tiltCss,
	unprojectOnGround,
	unprojectStagePoint,
	unprojectWorld,
	type View3dProjection,
	viewMatrix,
} from "../projection-3d.js";
import { worldToScreen } from "../utils/geometry.js";

const STAGE = { width: 1280, height: 800 };
const CAMS: ProjectionCamera[] = [
	{ pitch: 0, yaw: 0, fov: 600, horizon: 0.45 },
	{ pitch: 55, yaw: 0, fov: 600, horizon: 0.45 },
	{ pitch: 70, yaw: 30, fov: 400, horizon: 0.3, heightPx: 120 },
	{ pitch: 30, yaw: -120, fov: 1200, horizon: 0.6, heightPx: -40 },
	{ pitch: 84, yaw: 179, fov: 200, horizon: 0.1, heightPx: 300 },
];
const VIEWPORTS = [
	{ x: 0, y: 0, zoom: 1 },
	{ x: 140, y: 380, zoom: 0.8, rotation: 35 },
	{ x: -5000, y: 12000, zoom: 2.5, rotation: -170 },
];
const POINTS: { x: number; y: number }[] = [];
for (let y = -1600; y <= 800; y += 300)
	for (let x = -400; x <= 1680; x += 320) POINTS.push({ x, y });

/** The Mode 7 formula as it was written in mode7 / elevation before this module (reference). */
function reference(x: number, y: number, cam: ProjectionCamera, z: number) {
	const ox = STAGE.width / 2;
	const oy = STAGE.height * cam.horizon;
	const r = Math.PI / 180;
	const x0 = x - ox;
	const y0 = y - oy;
	const x1 = x0 * Math.cos(cam.yaw * r) - y0 * Math.sin(cam.yaw * r);
	const y1 = x0 * Math.sin(cam.yaw * r) + y0 * Math.cos(cam.yaw * r);
	const h = z - (cam.heightPx ?? 0);
	const y2 = y1 * Math.cos(cam.pitch * r) - h * Math.sin(cam.pitch * r);
	const z2 = y1 * Math.sin(cam.pitch * r) + h * Math.cos(cam.pitch * r);
	const w = 1 - z2 / cam.fov;
	return w <= 0 ? null : { x: ox + x1 / w, y: oy + y2 / w, depth: z2 };
}

/** Apply a column-major mat4 to (x, y, z, 1). */
function apply(m: Float32Array, x: number, y: number, z: number) {
	const o = [0, 0, 0, 0];
	for (let r = 0; r < 4; r++) o[r] = m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r];
	return o;
}

describe("projectStagePoint / unprojectStagePoint", () => {
	it("matches the formula mode7 and elevation used", () => {
		for (const cam of CAMS) {
			for (const z of [0, 40, 250]) {
				for (const p of POINTS) {
					const a = projectStagePoint(p.x, p.y, cam, STAGE, z);
					const b = reference(p.x, p.y, cam, z);
					if (!b) {
						expect(a).toBeNull();
						continue;
					}
					expect(a?.x).toBeCloseTo(b.x, 9);
					expect(a?.y).toBeCloseTo(b.y, 9);
					expect(a?.depth).toBeCloseTo(b.depth, 9);
				}
			}
		}
	});

	it("round-trips at any height", () => {
		for (const cam of CAMS) {
			for (const z of [0, 40, 250]) {
				for (const p of POINTS) {
					const s = projectStagePoint(p.x, p.y, cam, STAGE, z);
					if (!s) continue;
					const back = unprojectStagePoint(s.x, s.y, cam, STAGE, z);
					expect(back?.x).toBeCloseTo(p.x, 5);
					expect(back?.y).toBeCloseTo(p.y, 5);
				}
			}
		}
	});

	it("is the identity on a flat view", () => {
		const s = projectStagePoint(123, 456, CAMS[0], STAGE);
		expect(s).toEqual({ x: 123, y: 456, depth: 0, scale: 1 });
	});
});

describe("projectWorld / unprojectWorld", () => {
	it("goes through the viewport and scales the height by the zoom", () => {
		for (const viewport of VIEWPORTS) {
			for (const camera of CAMS) {
				const view: View3dProjection = { viewport, camera, stage: STAGE };
				const w = { x: 37, y: -12 };
				const s = worldToScreen(w.x, w.y, viewport);
				const a = projectWorld(w.x, w.y, view, 30);
				const b = projectStagePoint(s.x, s.y, camera, STAGE, 30 * viewport.zoom);
				expect(a).toEqual(b);
				if (!a) continue;
				const back = unprojectWorld(a.x, a.y, view, 30);
				expect(back?.x).toBeCloseTo(w.x, 4);
				expect(back?.y).toBeCloseTo(w.y, 4);
			}
		}
	});
});

describe("viewMatrix", () => {
	it("puts world points where projectWorld does, with the same depth", () => {
		for (const viewport of VIEWPORTS) {
			for (const camera of CAMS) {
				const view: View3dProjection = { viewport, camera, stage: STAGE };
				const m = viewMatrix(view);
				for (const p of POINTS) {
					for (const h of [0, 25, 120]) {
						// A world point near the screen (through the viewport's inverse).
						const world = unprojectWorld(p.x, p.y, { ...view, camera: CAMS[0] }, 0);
						if (!world) continue;
						const want = projectWorld(world.x, world.y, view, h);
						const [X, Y, D, W] = apply(m, world.x, world.y, h);
						if (!want) {
							expect(W).toBeLessThanOrEqual(1e-6);
							continue;
						}
						if (want.scale > 8) continue; // right at the eye: float32 rounding only
						const sx = ((X / W + 1) / 2) * STAGE.width;
						const sy = ((1 - Y / W) / 2) * STAGE.height;
						expect(Math.abs(sx - want.x)).toBeLessThan(0.05);
						expect(Math.abs(sy - want.y)).toBeLessThan(0.05);
						expect(Math.abs(D - want.depth)).toBeLessThan(0.05);
						expect(W).toBeCloseTo(1 / want.scale, 3);
					}
				}
			}
		}
	});

	it("takes vertices relative to an origin without losing precision far away", () => {
		const viewport = { x: -1_000_000 * 1.5 + 640, y: -2_000_000 * 1.5 + 400, zoom: 1.5 };
		const view: View3dProjection = { viewport, camera: CAMS[2], stage: STAGE };
		const origin = { x: 1_000_000, y: 2_000_000 };
		const m = viewMatrix(view, origin);
		for (const local of [
			{ x: 0, y: 0 },
			{ x: 31.25, y: -12.5 },
			{ x: 100, y: 64 },
		]) {
			const want = projectWorld(origin.x + local.x, origin.y + local.y, view, 10);
			if (!want) continue;
			const [X, Y, , W] = apply(m, local.x, local.y, 10);
			expect(((X / W + 1) / 2) * STAGE.width).toBeCloseTo(want.x, 2);
			expect(((1 - Y / W) / 2) * STAGE.height).toBeCloseTo(want.y, 2);
		}
	});
});

describe("unprojectOnGround", () => {
	const view: View3dProjection = {
		viewport: { x: 100, y: 300, zoom: 1, rotation: 20 },
		camera: { pitch: 60, yaw: 10, fov: 600, horizon: 0.45, heightPx: 50 },
		stage: STAGE,
	};

	it("is unprojectWorld on flat ground", () => {
		const p = unprojectOnGround(640, 600, view, () => 0);
		expect(p).toEqual({ ...unprojectWorld(640, 600, view, 0), height: 0 });
	});

	it("finds the hill the pointer is on", () => {
		const hill = (x: number, y: number) => Math.max(0, 120 - Math.hypot(x - 500, y - 200) / 2);
		for (const [sx, sy] of [
			[640, 500],
			[500, 420],
			[800, 650],
		]) {
			const p = unprojectOnGround(sx, sy, view, hill, { maxHeight: 120, steps: 128 });
			expect(p).not.toBeNull();
			if (!p) continue;
			expect(p.height).toBeCloseTo(hill(p.x, p.y), 6);
			// The found point, at its ground height, is drawn under the pointer.
			const s = projectWorld(p.x, p.y, view, p.height);
			expect(s?.x).toBeCloseTo(sx, 1);
			expect(s?.y).toBeCloseTo(sy, 1);
		}
	});

	it("is null in the sky", () => {
		expect(unprojectOnGround(640, 2, view, () => 0, { maxHeight: 10 })).toBeNull();
	});
});

describe("tiltCss", () => {
	it("builds the layer tilt mode7 applies", () => {
		expect(tiltCss({ pitch: 55, yaw: -12.34567, fov: 600, horizon: 0.45 })).toEqual({
			transform: "perspective(600px) rotateX(55deg) rotateZ(-12.346deg)",
			transformOrigin: "50% 45%",
		});
	});
});
