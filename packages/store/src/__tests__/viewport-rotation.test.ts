import { screenToWorld } from "@edv4h/usketch-shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBoardStore } from "../board-store.js";
import { clampViewportToBounds } from "../viewport-constraints.js";

const center = { x: 400, y: 300 };

describe("viewport rotation", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("keeps an unrotated viewport as the plain {x, y, zoom} shape", () => {
		const store = createBoardStore();
		store.setViewport({ x: 1, y: 2, zoom: 1, rotation: 0 });
		expect(store.getViewport()).toEqual({ x: 1, y: 2, zoom: 1 });
		store.setViewport({ x: 1, y: 2, zoom: 1, rotation: 360 });
		expect(store.getViewport()).toEqual({ x: 1, y: 2, zoom: 1 });
	});

	it("wraps rotation into (-180, 180]", () => {
		const store = createBoardStore();
		store.setViewport({ x: 0, y: 0, zoom: 1, rotation: 270 });
		expect(store.getViewport().rotation).toBe(-90);
	});

	it("rotateTo keeps the world point under the center fixed", () => {
		const store = createBoardStore();
		store.setViewport({ x: -120, y: 80, zoom: 1.5 });
		const before = screenToWorld(center.x, center.y, store.getViewport());
		store.rotateTo(35, center);
		const vp = store.getViewport();
		expect(vp.rotation).toBe(35);
		expect(vp.zoom).toBe(1.5);
		const after = screenToWorld(center.x, center.y, vp);
		expect(after.x).toBeCloseTo(before.x, 9);
		expect(after.y).toBeCloseTo(before.y, 9);
	});

	it("rotateTo(0) returns to an unrotated viewport", () => {
		const store = createBoardStore();
		store.rotateTo(60, center);
		store.rotateTo(0, center);
		expect(store.getViewport().rotation).toBeUndefined();
	});

	it("panBy and zoomTo preserve the rotation", () => {
		const store = createBoardStore();
		store.rotateTo(45, center);
		store.panBy(10, -5);
		expect(store.getViewport().rotation).toBe(45);
		store.zoomTo(2, center);
		expect(store.getViewport().rotation).toBe(45);
	});

	it("zoomTo keeps the world point under the zoom center fixed while rotated", () => {
		const store = createBoardStore();
		store.rotateTo(-70, center);
		const before = screenToWorld(center.x, center.y, store.getViewport());
		store.zoomTo(3, center);
		const after = screenToWorld(center.x, center.y, store.getViewport());
		expect(after.x).toBeCloseTo(before.x, 9);
		expect(after.y).toBeCloseTo(before.y, 9);
	});

	it("fitToBounds keeps the rotation and centers the bounds", () => {
		const store = createBoardStore();
		store.rotateTo(90, center);
		store.fitToBounds({ x: 100, y: 100, width: 200, height: 100 }, { width: 800, height: 600 }, 0, {
			animate: false,
		});
		const vp = store.getViewport();
		expect(vp.rotation).toBe(90);
		const mid = screenToWorld(400, 300, vp);
		expect(mid.x).toBeCloseTo(200, 9);
		expect(mid.y).toBeCloseTo(150, 9);
	});

	it("animated rotateTo turns the short way and never moves the pivot", () => {
		const frames: FrameRequestCallback[] = [];
		let now = 0;
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
		vi.stubGlobal("cancelAnimationFrame", () => {});
		vi.stubGlobal("performance", { now: () => now });

		const store = createBoardStore({ viewportAnimation: { durationMs: 100 } });
		store.setViewport({ x: 0, y: 0, zoom: 1, rotation: 170 });
		const pivot = screenToWorld(center.x, center.y, store.getViewport());
		store.rotateTo(-170, center, { animate: true });

		const seen: number[] = [];
		while (frames.length > 0) {
			now += 20;
			const cb = frames.shift() as FrameRequestCallback;
			cb(now);
			const vp = store.getViewport();
			seen.push(vp.rotation ?? 0);
			const p = screenToWorld(center.x, center.y, vp);
			expect(p.x).toBeCloseTo(pivot.x, 6);
			expect(p.y).toBeCloseTo(pivot.y, 6);
		}
		expect(store.getViewport().rotation).toBe(-170);
		// Every intermediate angle lies on the 20° arc through 180, not the 340° one.
		for (const r of seen) expect(Math.abs(r)).toBeGreaterThanOrEqual(170 - 1e-9);
	});

	it("animateViewportTo interpolates the rotation the short way", () => {
		const frames: FrameRequestCallback[] = [];
		let now = 0;
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
		vi.stubGlobal("cancelAnimationFrame", () => {});
		vi.stubGlobal("performance", { now: () => now });

		const store = createBoardStore({ viewportAnimation: { durationMs: 100 } });
		store.setViewport({ x: 0, y: 0, zoom: 1, rotation: 10 });
		store.animateViewportTo({ x: 0, y: 0, zoom: 1, rotation: -10 });
		while (frames.length > 0) {
			now += 25;
			(frames.shift() as FrameRequestCallback)(now);
			const r = store.getViewport().rotation ?? 0;
			expect(Math.abs(r)).toBeLessThanOrEqual(10 + 1e-9);
		}
		expect(store.getViewport().rotation).toBe(-10);
	});

	it("clampViewportToBounds leaves a rotated viewport untouched", () => {
		const vp = { x: 5000, y: 5000, zoom: 1, rotation: 30 };
		expect(
			clampViewportToBounds(
				vp,
				{ x: 0, y: 0, width: 100, height: 100 },
				{ width: 800, height: 600 },
			),
		).toBe(vp);
	});
});
