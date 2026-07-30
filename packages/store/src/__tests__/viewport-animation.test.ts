import { describe, expect, it } from "vitest";
import { createBoardStore } from "../board-store.js";

describe("viewport animation config", () => {
	it("defaults to enabled / 350ms", () => {
		const store = createBoardStore();
		const cfg = store.getViewportAnimation();
		expect(cfg.enabled).toBe(true);
		expect(cfg.durationMs).toBe(350);
		expect(typeof cfg.easing).toBe("function");
	});

	it("honours createBoardStore overrides", () => {
		const store = createBoardStore({ viewportAnimation: { durationMs: 100 } });
		const cfg = store.getViewportAnimation();
		expect(cfg.durationMs).toBe(100);
		expect(cfg.enabled).toBe(true); // untouched fields keep defaults
	});

	it("setViewportAnimation merges partial config", () => {
		const store = createBoardStore();
		store.setViewportAnimation({ enabled: false });
		expect(store.getViewportAnimation().enabled).toBe(false);
		expect(store.getViewportAnimation().durationMs).toBe(350);
	});
});

describe("animateViewportTo", () => {
	it("commits instantly when animation is disabled", () => {
		const store = createBoardStore({ viewportAnimation: { enabled: false } });
		store.animateViewportTo({ x: 100, y: 200, zoom: 2 });
		expect(store.getViewport()).toEqual({ x: 100, y: 200, zoom: 2 });
	});

	it("commits instantly when opts.animate === false", () => {
		const store = createBoardStore();
		store.animateViewportTo({ x: -50, y: 75, zoom: 0.5 }, { animate: false });
		expect(store.getViewport()).toEqual({ x: -50, y: 75, zoom: 0.5 });
	});

	it("emits a viewport:changed mutation on commit", () => {
		const store = createBoardStore({ viewportAnimation: { enabled: false } });
		const types: string[] = [];
		store.onMutation((e) => types.push(e.type));
		store.animateViewportTo({ x: 1, y: 2, zoom: 1 }, { animate: false });
		expect(types).toContain("viewport:changed");
	});
});

describe("fitToBounds", () => {
	it("centers bounds at the given zoom (instant variant)", () => {
		const store = createBoardStore();
		// 200x100 bounds fit into 1000x1000 minus 40px padding → zoom limited by width.
		store.fitToBounds({ x: 0, y: 0, width: 200, height: 100 }, { width: 1000, height: 1000 }, 40, {
			animate: false,
		});
		const vp = store.getViewport();
		// availW=920 → zoom = 920/200 = 4.6; center (100,50) at screen centre (500,500).
		expect(vp.zoom).toBeCloseTo(4.6, 5);
		expect(vp.x).toBeCloseTo(500 - 100 * 4.6, 5);
		expect(vp.y).toBeCloseTo(500 - 50 * 4.6, 5);
	});
});
