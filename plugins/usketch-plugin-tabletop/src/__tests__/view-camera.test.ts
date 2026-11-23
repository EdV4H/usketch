import { screenToWorld, viewportAnchoredAt } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	applyViewCamera,
	fitViewToScreen,
	isAtView,
	pinToViewConstraint,
	screenViewRect,
	screenWorldBounds,
	stayInViewConstraint,
	viewRectOf,
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

	it("keeps a held camera upright (turning it would show outside the view)", () => {
		const vp = { x: 1, y: 2, zoom: 3, rotation: 30 };
		expect(pinToViewConstraint(opts)(vp).rotation ?? 0).toBe(0);
		expect(stayInViewConstraint(opts)(vp).rotation ?? 0).toBe(0);
	});

	it("a view turned to face a seat across the table turns the camera the other way", () => {
		const across = { ...rect, rotation: 180 };
		const vp = fitViewToScreen(across, size);
		expect(vp.rotation).toBe(180);
		expect(vp.zoom).toBeCloseTo(0.5);
		// The view's centre is in the screen's centre, and the screen's top-left of it
		// shows the view's bottom-right corner (the board turned round).
		const centre = screenToWorld(size.width / 2, size.height / 2, vp);
		expect(centre.x).toBeCloseTo(500);
		expect(centre.y).toBeCloseTo(250);
		const corner = screenToWorld(24, 49, vp);
		expect(corner.x).toBeCloseTo(1000);
		expect(corner.y).toBeCloseTo(500);
		expect(isAtView(vp, across, size)).toBe(true);
		expect(isAtView(fitViewToScreen(rect, size), across, size)).toBe(false);
	});

	it("a view turned a quarter fits its own width across the screen", () => {
		const side = { x: 0, y: 0, width: 1000, height: 500, rotation: 90 };
		const vp = fitViewToScreen(side, size);
		expect(vp.rotation).toBe(-90);
		expect(vp.zoom).toBeCloseTo(0.5);
		const centre = screenToWorld(size.width / 2, size.height / 2, vp);
		expect(centre.x).toBeCloseTo(500);
		expect(centre.y).toBeCloseTo(250);
	});

	it("held cameras keep a turned view's turn and stay inside it", () => {
		const across = { ...rect, rotation: 180 };
		const o = { getRect: () => across, getSize: () => size };
		expect(pinToViewConstraint(o)({ x: 1, y: 2, zoom: 3 })).toEqual(fitViewToScreen(across, size));
		const held = stayInViewConstraint(o)({ x: 9999, y: 0, zoom: 2, rotation: 30 });
		expect(held.rotation).toBe(180);
		expect(held.zoom).toBe(2);
		// Panned far off: what the screen shows is still inside the view (+ margin).
		const shown = screenWorldBounds(held, size);
		expect(shown.x).toBeGreaterThanOrEqual(-12 - 1e-6);
		expect(shown.x + shown.width).toBeLessThanOrEqual(1012 + 1e-6);
		expect(stayInViewConstraint(o)({ x: 0, y: 0, zoom: 0.1 }).zoom).toBeCloseTo(0.5);
	});

	it("screenViewRect makes what is on screen a view that brings the same picture back", () => {
		const upright = { x: -100, y: -50, zoom: 2 };
		expect(screenViewRect(upright, size)).toEqual(visibleWorldRect(upright, size));
		const across = viewportAnchoredAt({ x: 500, y: 250 }, { x: 274, y: 174 }, 0.5, 180);
		const view = screenViewRect(across, size);
		expect(view.rotation).toBe(180);
		expect(view.width).toBeCloseTo(1096);
		expect(view.height).toBeCloseTo(696);
		const back = fitViewToScreen(view, size, 0);
		expect(back.rotation).toBe(180);
		expect(back.zoom).toBeCloseTo(0.5);
		expect(back.x).toBeCloseTo(across.x);
		expect(back.y).toBeCloseTo(across.y);
	});

	it("viewRectOf carries a shape's turn, and none when it isn't turned", () => {
		expect(viewRectOf({ x: 1, y: 2, width: 3, height: 4 })).toEqual({
			x: 1,
			y: 2,
			width: 3,
			height: 4,
		});
		expect(viewRectOf({ x: 1, y: 2, width: 3, height: 4, rotation: 180 }).rotation).toBe(180);
	});

	it("zoom: a zero or broken zoom falls back to the fit", () => {
		const constrain = stayInViewConstraint(opts);
		expect(constrain({ x: 5, y: 5, zoom: 0 })).toEqual(fitViewToScreen(rect, size));
		expect(constrain({ x: 5, y: 5, zoom: Number.NaN })).toEqual(fitViewToScreen(rect, size));
	});

	it("bounds what a turned screen shows by its corners", () => {
		const b = screenWorldBounds({ x: 0, y: 0, zoom: 1, rotation: 90 }, { width: 200, height: 100 });
		expect(b.width).toBeCloseTo(100);
		expect(b.height).toBeCloseTo(200);
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

	it("finishes a move the timer outran before holding", () => {
		vi.useFakeTimers();
		const store = createBoardStore();
		applyViewCamera(store, () => rect, "zoom", { ...opts, durationMs: 100 });
		vi.advanceTimersByTime(200);
		expect(isAtView(store.getViewport(), rect, size)).toBe(true);
	});

	it("applying another view releases the first", () => {
		vi.useFakeTimers();
		const store = createBoardStore();
		const other = { x: 2000, y: 0, width: 500, height: 300 };
		const a = applyViewCamera(store, () => rect, "fixed", { ...opts, durationMs: 100 });
		applyViewCamera(store, () => other, "fixed", { ...opts, durationMs: 100 });
		vi.advanceTimersByTime(300);
		expect(isAtView(store.getViewport(), other, size)).toBe(true);
		a.release(); // already released: leaves the second hold alone
		expect(store.getViewportConstraint()).not.toBeNull();
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
