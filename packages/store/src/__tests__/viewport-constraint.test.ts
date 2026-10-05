import { describe, expect, it } from "vitest";
import { createBoardStore } from "../board-store.js";
import { boundsConstraint, clampViewportToBounds } from "../viewport-constraints.js";

describe("viewport constraint", () => {
	it("applies on every commit path (setViewport / panBy / zoomTo)", () => {
		const store = createBoardStore();
		// Lock x to 0 and zoom to 2; vertical free.
		store.setViewportConstraint((vp) => ({ x: 0, y: vp.y, zoom: 2 }));
		expect(store.getViewport()).toEqual({ x: 0, y: 0, zoom: 2 });

		store.setViewport({ x: 100, y: 50, zoom: 5 });
		expect(store.getViewport()).toEqual({ x: 0, y: 50, zoom: 2 });

		store.panBy(30, 20); // x pinned, y accumulates
		expect(store.getViewport()).toEqual({ x: 0, y: 70, zoom: 2 });

		store.zoomTo(8, { x: 0, y: 0 }); // zoom pinned to 2
		expect(store.getViewport().zoom).toBe(2);
	});

	it("re-commits the current viewport when a constraint is installed, and releases on clear", () => {
		const store = createBoardStore();
		store.setViewport({ x: 40, y: 40, zoom: 3 });
		store.setViewportConstraint((vp) => ({ ...vp, zoom: 1 }));
		expect(store.getViewport()).toEqual({ x: 40, y: 40, zoom: 1 }); // snapped on install

		store.setViewportConstraint(null);
		expect(store.getViewportConstraint()).toBeNull();
		store.setViewport({ x: 5, y: 5, zoom: 4 }); // free again
		expect(store.getViewport()).toEqual({ x: 5, y: 5, zoom: 4 });
	});
});

describe("clampViewportToBounds", () => {
	const bounds = { x: 0, y: 0, width: 1000, height: 2000 };
	const size = { width: 400, height: 300 };

	it("can't scroll above/left of bounds (top-left pinned at max)", () => {
		expect(clampViewportToBounds({ x: 100, y: 100, zoom: 1 }, bounds, size)).toEqual({
			x: 0,
			y: 0,
			zoom: 1,
		});
	});

	it("stops at the right/bottom of bounds", () => {
		// xMin = 400 - 1000 = -600, yMin = 300 - 2000 = -1700
		expect(clampViewportToBounds({ x: -5000, y: -5000, zoom: 1 }, bounds, size)).toEqual({
			x: -600,
			y: -1700,
			zoom: 1,
		});
	});

	it("content smaller than screen → pinned (no scroll)", () => {
		const small = { x: 0, y: 0, width: 100, height: 100 };
		expect(clampViewportToBounds({ x: 50, y: 50, zoom: 1 }, small, size)).toEqual({
			x: 0,
			y: 0,
			zoom: 1,
		});
	});
});

describe("boundsConstraint", () => {
	it("clamps via clampViewportToBounds; passes through when bounds/size unavailable", () => {
		const c = boundsConstraint({
			getBounds: () => ({ x: 0, y: 0, width: 1000, height: 2000 }),
			getViewportSize: () => ({ width: 400, height: 300 }),
		});
		expect(c({ x: 100, y: 100, zoom: 1 })).toEqual({ x: 0, y: 0, zoom: 1 });

		const off = boundsConstraint({ getBounds: () => null, getViewportSize: () => null });
		expect(off({ x: 7, y: 7, zoom: 3 })).toEqual({ x: 7, y: 7, zoom: 3 });
	});
});
