import { describe, expect, it } from "vitest";
import type { BoardStore, ShapeData, Viewport } from "../index.js";
import {
	centerOnWorld,
	easeInOutCubic,
	fitContent,
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
