import { describe, expect, it } from "vitest";
import { fitViewport, fitZoom, stayInRectConstraint, visibleWorldRect } from "../camera.js";

const size = { width: 1000, height: 600 };
const rect = { x: 0, y: 0, width: 2000, height: 1000 };
const view = (vp: { x: number; y: number; zoom: number }) => visibleWorldRect(vp, size);

describe("fitViewport", () => {
	it("centres the rect with margins", () => {
		const vp = fitViewport(rect, size, 0);
		expect(vp.zoom).toBeCloseTo(0.5);
		const v = view(vp);
		expect(v.x).toBeCloseTo(0);
		expect(v.width).toBeCloseTo(2000);
		expect(v.y).toBeCloseTo(-100);
	});

	it("is the inverse of visibleWorldRect", () => {
		const r = { x: 50, y: 80, width: 400, height: 240 };
		const v = view(fitViewport(r, size, 0));
		expect(v.x).toBeCloseTo(50);
		expect(v.width).toBeCloseTo(400);
	});
});

describe("stayInRectConstraint", () => {
	const constrain = stayInRectConstraint({ getRect: () => rect, getSize: () => size, padding: 0 });

	it("does not zoom out past the fit", () => {
		expect(constrain({ x: 0, y: 0, zoom: 0.1 }).zoom).toBeCloseTo(fitZoom(rect, size, 0));
	});

	it("does not pan outside", () => {
		const tl = view(constrain({ x: 500, y: 500, zoom: 1 }));
		expect(tl.x).toBeCloseTo(0);
		expect(tl.y).toBeCloseTo(0);
		const br = view(constrain({ x: -5000, y: -5000, zoom: 1 }));
		expect(br.x + br.width).toBeCloseTo(2000);
		expect(br.y + br.height).toBeCloseTo(1000);
	});

	it("leaves a viewport inside alone", () => {
		const vp = { x: -300, y: -200, zoom: 1 };
		expect(constrain(vp)).toEqual(vp);
	});

	it("centres an axis where the place is smaller than the screen", () => {
		const small = stayInRectConstraint({
			getRect: () => ({ x: 0, y: 0, width: 100, height: 100 }),
			getSize: () => size,
			padding: 0,
		});
		const v = view(small({ x: 0, y: 0, zoom: 6 }));
		expect(v.x + v.width / 2).toBeCloseTo(50);
	});

	it("ignores a rotated camera or an unknown place", () => {
		const rotated = { x: 1, y: 2, zoom: 0.01, rotation: 30 };
		expect(constrain(rotated)).toBe(rotated);
		const none = stayInRectConstraint({ getRect: () => null, getSize: () => size });
		const vp = { x: 1, y: 2, zoom: 0.01 };
		expect(none(vp)).toBe(vp);
	});
});
