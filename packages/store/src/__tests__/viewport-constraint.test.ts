import { describe, expect, it } from "vitest";
import { createBoardStore } from "../board-store.js";

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
