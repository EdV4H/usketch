import type { BoardStore, Viewport } from "@edv4h/usketch-shared";
import { screenToWorld } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { applyDeepLink } from "../apply.js";
import { captureView, viewportForView } from "../view.js";

/** Just enough of a BoardStore for viewport moves (no shapes). */
function fakeStore(initial: Viewport) {
	let vp = initial;
	const store = {
		getViewport: () => vp,
		animateViewportTo: (next: Viewport) => {
			vp = next;
		},
		getShape: () => undefined,
		setSelection: () => {},
		onMutation: () => () => {},
	} as unknown as BoardStore;
	return { store, current: () => vp };
}

const small = { getViewportSize: () => ({ width: 800, height: 400 }) };
const large = { getViewportSize: () => ({ width: 1600, height: 1000 }) };

describe("captureView", () => {
	it("returns the world point at the canvas centre and the zoom", () => {
		const { store } = fakeStore({ x: 150, y: 75, zoom: 0.5 });
		expect(captureView(store, small)).toEqual({ x: 500, y: 250, zoom: 0.5 });
	});

	it("accounts for a rotated viewport", () => {
		const vp = { x: 650, y: 325, zoom: 0.5, rotation: 180 };
		const { store } = fakeStore(vp);
		const view = captureView(store, small);
		expect(view.x).toBeCloseTo(500);
		expect(view.y).toBeCloseTo(250);
	});
});

describe("viewportForView", () => {
	it("puts the view's world point at the centre of a different-sized canvas", () => {
		const { store } = fakeStore({ x: 0, y: 0, zoom: 1 });
		const vp = viewportForView(store, { x: 500, y: 250, zoom: 0.5 }, large);
		const centre = screenToWorld(800, 500, vp);
		expect(centre.x).toBeCloseTo(500);
		expect(centre.y).toBeCloseTo(250);
		expect(vp.zoom).toBe(0.5);
	});

	it("keeps the recipient's current rotation", () => {
		const { store } = fakeStore({ x: 0, y: 0, zoom: 1, rotation: 90 });
		const vp = viewportForView(store, { x: 10, y: 20, zoom: 2 }, small);
		expect(vp.rotation).toBe(90);
		const centre = screenToWorld(400, 200, vp);
		expect(centre.x).toBeCloseTo(10);
		expect(centre.y).toBeCloseTo(20);
	});
});

describe("applyDeepLink with a view", () => {
	it("centres the view on the canvas", () => {
		const { store, current } = fakeStore({ x: 0, y: 0, zoom: 1 });
		applyDeepLink(store, "?cx=500&cy=250&zoom=0.5", undefined, large);
		const centre = screenToWorld(800, 500, current());
		expect(centre.x).toBeCloseTo(500);
		expect(centre.y).toBeCloseTo(250);
	});

	it("lets an exact camera win over a view", () => {
		const { store, current } = fakeStore({ x: 0, y: 0, zoom: 1 });
		applyDeepLink(store, "?x=10&y=20&cx=500&cy=250&zoom=2", undefined, large);
		expect(current()).toEqual({ x: 10, y: 20, zoom: 2 });
	});
});
