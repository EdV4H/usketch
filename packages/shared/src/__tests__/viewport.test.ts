import { describe, expect, it } from "vitest";
import type { BoardStore, ShapeData, Viewport } from "../index.js";
import { worldToScreen } from "../utils/geometry.js";
import {
	centerOnWorld,
	easeInOutCubic,
	fitContent,
	screenCenterWorld,
	zoomBy,
	zoomToLevel,
} from "../utils/viewport.js";

// Node test env has no `window`, so getScreenSize() → { 1280, 720 }.
const W = 1280;
const H = 720;

function shape(id: string, x: number, y: number, width: number, height: number): ShapeData {
	return { id, type: "rect", x, y, width, height, rotation: 0, opacity: 1 } as ShapeData;
}

function makeStore(viewport: Viewport, shapes: ShapeData[] = []) {
	let vp = viewport;
	const captured: { target?: Viewport; fit?: { bounds: unknown; padding?: number } } = {};
	const map = new Map(shapes.map((s) => [s.id, s]));
	const store = {
		getViewport: () => vp,
		getShapes: () => map,
		animateViewportTo: (target: Viewport) => {
			captured.target = target;
			vp = target;
		},
		fitToBounds: (bounds: unknown, _size: unknown, padding?: number) => {
			captured.fit = { bounds, padding };
		},
	} as unknown as BoardStore;
	return { store, captured };
}

describe("easeInOutCubic", () => {
	it("maps endpoints and midpoint", () => {
		expect(easeInOutCubic(0)).toBe(0);
		expect(easeInOutCubic(1)).toBe(1);
		expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
	});
});

describe("screenCenterWorld", () => {
	it("matches the hand-rolled (W/2 - vp.x) / zoom when the view is not rotated", () => {
		const vp: Viewport = { x: -300, y: 120, zoom: 1.5 };
		const { store } = makeStore(vp);
		const c = screenCenterWorld(store);
		expect(c.x).toBeCloseTo((W / 2 - vp.x) / vp.zoom, 9);
		expect(c.y).toBeCloseTo((H / 2 - vp.y) / vp.zoom, 9);
	});

	it("returns the world point drawn at the screen centre when the view is rotated", () => {
		const vp: Viewport = { x: 200, y: -80, zoom: 2, rotation: 35 };
		const { store } = makeStore(vp);
		const c = screenCenterWorld(store);
		const s = worldToScreen(c.x, c.y, vp);
		expect(s.x).toBeCloseTo(W / 2, 6);
		expect(s.y).toBeCloseTo(H / 2, 6);
		// The unrotated formula plugins used to hand-roll lands far off-centre.
		const naive = worldToScreen((W / 2 - vp.x) / vp.zoom, (H / 2 - vp.y) / vp.zoom, vp);
		expect(Math.hypot(naive.x - W / 2, naive.y - H / 2)).toBeGreaterThan(100);
	});
});

describe("centerOnWorld", () => {
	it("puts the world point at the screen centre, keeping zoom", () => {
		const { store, captured } = makeStore({ x: 0, y: 0, zoom: 2 });
		centerOnWorld(store, { x: 100, y: 50 });
		expect(captured.target).toEqual({ x: W / 2 - 100 * 2, y: H / 2 - 50 * 2, zoom: 2 });
	});

	it("re-zooms when a zoom override is given", () => {
		const { store, captured } = makeStore({ x: 0, y: 0, zoom: 1 });
		centerOnWorld(store, { x: 10, y: 20 }, { zoom: 4 });
		expect(captured.target?.zoom).toBe(4);
	});
});

describe("zoomToLevel / zoomBy", () => {
	it("zooms about the screen centre", () => {
		const { store, captured } = makeStore({ x: 0, y: 0, zoom: 1 });
		zoomToLevel(store, 2);
		const cx = W / 2;
		const cy = H / 2;
		// scale = 2 → x = cx - (cx - 0)*2
		expect(captured.target).toEqual({ x: cx - cx * 2, y: cy - cy * 2, zoom: 2 });
	});

	it("clamps zoom into [0.1, 10]", () => {
		const { store, captured } = makeStore({ x: 0, y: 0, zoom: 1 });
		zoomToLevel(store, 999);
		expect(captured.target?.zoom).toBe(10);
	});

	it("zoomBy multiplies the current zoom", () => {
		const { store, captured } = makeStore({ x: 0, y: 0, zoom: 3 });
		zoomBy(store, 2);
		expect(captured.target?.zoom).toBe(6);
	});
});

describe("fitContent", () => {
	it("fits the union bounds of all shapes", () => {
		const { store, captured } = makeStore({ x: 0, y: 0, zoom: 1 }, [
			shape("a", 0, 0, 100, 100),
			shape("b", 200, 50, 100, 100),
		]);
		fitContent(store);
		expect(captured.fit?.bounds).toEqual({ x: 0, y: 0, width: 300, height: 150 });
	});

	it("no-ops on an empty board", () => {
		const { store, captured } = makeStore({ x: 0, y: 0, zoom: 1 });
		fitContent(store);
		expect(captured.fit).toBeUndefined();
	});
});
