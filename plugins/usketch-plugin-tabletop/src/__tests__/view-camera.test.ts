import { createBoardStore } from "@edv4h/usketch-store";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	applyViewCamera,
	fitViewToScreen,
	isAtView,
	pinToViewConstraint,
	stayInViewConstraint,
	visibleWorldRect,
} from "../view-camera.js";

const rect = { x: 0, y: 0, width: 1000, height: 500 };
const size = { width: 548, height: 348 }; // 500 × 300 inside a 24 px margin
const opts = { getRect: () => rect, getSize: () => size };

afterEach(() => {
	vi.useRealTimers();
});

describe("view camera math", () => {
	it("fits the whole view, centred, whatever the screen's shape", () => {
		const vp = fitViewToScreen(rect, size);
		expect(vp.zoom).toBeCloseTo(0.5);
		const shown = visibleWorldRect(vp, size);
		expect(shown.x + shown.width / 2).toBeCloseTo(500);
		expect(shown.y + shown.height / 2).toBeCloseTo(250);
		expect(shown.width).toBeGreaterThanOrEqual(1000);
		expect(isAtView(vp, rect, size)).toBe(true);
	});

	it("zoom: can't zoom out past the view or pan outside it; zooming in is free", () => {
		const constrain = stayInViewConstraint(opts);
		expect(constrain({ x: 0, y: 0, zoom: 0.1 }).zoom).toBeCloseTo(0.5);
		const zoomed = constrain({ x: 0, y: 0, zoom: 2 });
		expect(zoomed.zoom).toBe(2);
		// Panned far to the left of the view: stopped at its left edge (+ margin).
		const panned = constrain({ x: 5000, y: 0, zoom: 2 });
		expect(visibleWorldRect(panned, size).x).toBeCloseTo(-12);
	});

	it("fixed: always the fitted view", () => {
		const constrain = pinToViewConstraint(opts);
		expect(constrain({ x: 123, y: -9, zoom: 3 })).toEqual(fitViewToScreen(rect, size));
	});

	it("leaves a rotated camera alone", () => {
		const vp = { x: 1, y: 2, zoom: 3, rotation: 30 };
		expect(pinToViewConstraint(opts)(vp)).toBe(vp);
		expect(stayInViewConstraint(opts)(vp)).toBe(vp);
	});
});

describe("applyViewCamera", () => {
	it("moves to the view, holds it (fixed) and lets go on release", () => {
		const store = createBoardStore();
		const handle = applyViewCamera(store, () => rect, "fixed", { ...opts, animate: false });
		expect(isAtView(store.getViewport(), rect, size)).toBe(true);
		store.setViewport({ x: 999, y: 999, zoom: 4 });
		expect(isAtView(store.getViewport(), rect, size)).toBe(true);
		handle.release();
		expect(store.getViewportConstraint()).toBeNull();
		store.setViewport({ x: 999, y: 999, zoom: 4 });
		expect(store.getViewport().zoom).toBe(4);
	});

	it("free: no hold, but can return to the view", () => {
		const store = createBoardStore();
		const handle = applyViewCamera(store, () => rect, "free", { ...opts, animate: false });
		expect(store.getViewportConstraint()).toBeNull();
		store.setViewport({ x: 999, y: 999, zoom: 4 });
		handle.returnToView({ animate: false });
		expect(isAtView(store.getViewport(), rect, size)).toBe(true);
	});

	it("puts the hold on after an animated move, and not at all if released first", () => {
		vi.useFakeTimers();
		const store = createBoardStore();
		const handle = applyViewCamera(store, () => rect, "zoom", { ...opts, durationMs: 100 });
		expect(store.getViewportConstraint()).toBeNull();
		vi.advanceTimersByTime(200);
		expect(store.getViewportConstraint()).not.toBeNull();
		handle.release();
		const early = applyViewCamera(store, () => rect, "zoom", { ...opts, durationMs: 100 });
		early.release();
		vi.advanceTimersByTime(200);
		expect(store.getViewportConstraint()).toBeNull();
	});

	it("doesn't clear a constraint someone else installed", () => {
		const store = createBoardStore();
		const handle = applyViewCamera(store, () => rect, "fixed", { ...opts, animate: false });
		const other = (vp: { x: number; y: number; zoom: number }) => vp;
		store.setViewportConstraint(other);
		handle.release();
		expect(store.getViewportConstraint()).toBe(other);
	});
});
