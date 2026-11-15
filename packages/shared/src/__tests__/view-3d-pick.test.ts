import { describe, expect, it } from "vitest";
import { cameraEye, projectWorld } from "../projection-3d.js";
import { normalizeShapeView3d, type ShapeView3d } from "../shape-view-3d.js";
import { shapeView3dFaces } from "../shape-view-3d-faces.js";
import type { Point } from "../types/geometry.js";
import type { ShapeData } from "../types/shape.js";
import {
	pickView3d,
	rayQuad,
	view3dCamera,
	view3dDragPoint,
	view3dProjection,
	view3dRay,
} from "../view-3d-pick.js";
import { FLAT_VIEW_3D } from "../view-3d-state.js";

const state = {
	...FLAT_VIEW_3D,
	amount: 1,
	camera: { pitch: 60, fov: 600, horizon: 0.4, height: 40 },
};
const view = view3dProjection(state, { x: 400, y: 450, zoom: 1 }, { width: 800, height: 600 });

const shape = (id: string, x: number, y: number, w = 100, h = 80): ShapeData =>
	({ id, type: "box", x, y, width: w, height: h, rotation: 0, zIndex: "a" }) as ShapeData;
const inBox = (s: ShapeData, p: Point) =>
	p.x >= s.x && p.x <= s.x + s.width && p.y >= s.y && p.y <= s.y + s.height;
const stand = normalizeShapeView3d({ mode: "stand", facing: "fixed" }) as ShapeView3d;

describe("view3dCamera / view3dProjection", () => {
	it("scales the pitch and height by the amount", () => {
		expect(view3dCamera({ ...state, amount: 0.5 }, 2)).toEqual({
			pitch: 30,
			yaw: 0,
			fov: 600,
			horizon: 0.4,
			heightPx: 40,
		});
		expect(view.camera.heightPx).toBe(40);
	});
});

describe("rayQuad", () => {
	it("finds where a ray meets a quad, in the quad's own coordinates", () => {
		const ray = {
			eye: [5, 5, 10] as [number, number, number],
			dir: [0, 0, -1] as [number, number, number],
		};
		const q = {
			at: [0, 0, 0] as [number, number, number],
			u: [10, 0, 0] as [number, number, number],
			v: [0, 20, 0] as [number, number, number],
		};
		const hit = rayQuad(ray, q);
		expect(hit?.t).toBeCloseTo(10);
		expect(hit?.s).toBeCloseTo(0.5);
		expect(hit?.r).toBeCloseTo(0.25);
		expect(rayQuad({ ...ray, eye: [50, 5, 10] }, q)).toBeNull();
		expect(rayQuad({ ...ray, dir: [1, 0, 0] }, q)).toBeNull();
	});
});

describe("pickView3d", () => {
	const hitTest = (s: ShapeData, p: Point) => inBox(s, p);

	it("picks the ground under the pointer", () => {
		const s = projectWorld(30, -200, view);
		if (!s) throw new Error("not in view");
		const pick = pickView3d({ x: s.x, y: s.y, view, shapes: [], hitTest });
		expect(pick?.shapeId).toBeNull();
		expect(pick?.point.x).toBeCloseTo(30, 3);
		expect(pick?.point.y).toBeCloseTo(-200, 3);
	});

	it("picks a flat shape where it lies, the top one first", () => {
		const a = shape("a", 0, -100);
		const b = shape("b", 50, -100);
		const s = projectWorld(80, -60, view);
		if (!s) throw new Error("not in view");
		const pick = pickView3d({ x: s.x, y: s.y, view, shapes: [a, b], hitTest });
		expect(pick?.shapeId).toBe("b");
	});

	it("picks a stood-up shape by its face and maps it back into its own box", () => {
		const sign = shape("sign", -50, -300);
		const view3d = new Map([["sign", stand]]);
		const faces = shapeView3dFaces(sign, stand, {
			amount: 1,
			yaw: 0,
			viewportRotation: 0,
			groundHeight: 0,
			pad: 0,
		});
		// The middle of the face (upright, at its foot's line).
		const q = faces.picture;
		const mid = [
			q.at[0] + q.u[0] / 2 + q.v[0] / 2,
			q.at[1] + q.u[1] / 2 + q.v[1] / 2,
			q.at[2] + q.u[2] / 2 + q.v[2] / 2,
		];
		const s = projectWorld(mid[0], mid[1], view, mid[2]);
		if (!s) throw new Error("not in view");
		// Behind it, on the ground, a flat shape: the face in front wins.
		const behind = shape("behind", -200, -900, 400, 500);
		const pick = pickView3d({ x: s.x, y: s.y, view, shapes: [sign, behind], view3d, hitTest });
		expect(pick?.shapeId).toBe("sign");
		expect(pick && inBox(sign, pick.point)).toBe(true);
		expect(pick?.height).toBeCloseTo(40, 0);

		// A ridge between the eye and the sign hides it.
		const eye = cameraEye(view);
		const midY = (eye.y + sign.y + sign.height) / 2;
		const ridge = (_x: number, yy: number) => (Math.abs(yy - midY) < 15 ? 5000 : 0);
		const hidden = pickView3d({
			x: s.x,
			y: s.y,
			view,
			shapes: [sign],
			view3d,
			hitTest,
			groundAt: ridge,
		});
		expect(hidden?.shapeId).toBeNull();
	});
});

describe("view3dDragPoint", () => {
	it("follows the pointer at the picked height, keeping the offset", () => {
		const s = projectWorld(10, -100, view, 50);
		if (!s) throw new Error("not in view");
		const p = view3dDragPoint(s.x, s.y, view, { height: 50, offset: { x: 5, y: -3 } });
		expect(p?.x).toBeCloseTo(15, 3);
		expect(p?.y).toBeCloseTo(-103, 3);
		expect(view3dRay(s.x, s.y, view)).not.toBeNull();
	});
});
