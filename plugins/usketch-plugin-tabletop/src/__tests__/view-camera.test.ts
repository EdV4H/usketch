import {
	projectStagePoint,
	screenToWorld,
	type Viewport,
	viewportAnchoredAt,
	worldToScreen,
} from "@edv4h/usketch-shared";
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

describe("tilted view camera", () => {
	const tilt = { pitch: 35, fov: 1200, horizon: 0.5 };
	const screen = { width: 1200, height: 800 };
	const view = { x: 0, y: 0, width: 1600, height: 900 };
	const pad = 24;
	const cam = { ...tilt, yaw: 0 };
	// The view's corners as the tilted camera draws them.
	const drawn = (vp: Viewport, r = view) =>
		[
			[r.x, r.y],
			[r.x + r.width, r.y],
			[r.x, r.y + r.height],
			[r.x + r.width, r.y + r.height],
		].map(([x, y]) => {
			const s = worldToScreen(x, y, vp);
			const p = projectStagePoint(s.x, s.y, cam, screen);
			if (!p) throw new Error("behind the eye");
			return p;
		});

	it("keeps the whole tilted view on screen: far edge on the top padding, near edge tight", () => {
		const vp = fitViewToScreen(view, screen, pad, tilt);
		const [tl, tr, bl, br] = drawn(vp);
		expect(tl.y).toBeCloseTo(pad, 3);
		expect(tr.y).toBeCloseTo(pad, 3);
		for (const p of [tl, tr, bl, br]) {
			expect(p.x).toBeGreaterThanOrEqual(pad - 1e-6);
			expect(p.x).toBeLessThanOrEqual(screen.width - pad + 1e-6);
			expect(p.y).toBeLessThanOrEqual(screen.height - pad + 1e-6);
		}
		// Centred across, near edge wider than the far edge, and as large as fits.
		expect((bl.x + br.x) / 2).toBeCloseTo(screen.width / 2, 3);
		expect(br.x - bl.x).toBeGreaterThan(tr.x - tl.x);
		const tight = Math.min(screen.width - pad - br.x, screen.height - pad - bl.y);
		expect(tight).toBeLessThan(0.01);
	});

	it("a flat tilt (pitch 0) or none fits like before", () => {
		expect(fitViewToScreen(view, screen, pad, { ...tilt, pitch: 0 })).toEqual(
			fitViewToScreen(view, screen, pad),
		);
		expect(fitViewToScreen(view, screen, pad, null)).toEqual(fitViewToScreen(view, screen, pad));
	});

	it("frames a turned view for the tilt too", () => {
		const turned = { ...view, rotation: 180 };
		const vp = fitViewToScreen(turned, screen, pad, tilt);
		expect(vp.rotation).toBe(180);
		const corners = drawn(vp);
		// Turned 180°: the view's bottom edge (y = 900) is the far one now.
		const far = corners.slice(2);
		for (const p of far) expect(p.y).toBeCloseTo(pad, 3);
		for (const p of corners) {
			expect(p.x).toBeGreaterThanOrEqual(pad - 1e-6);
			expect(p.x).toBeLessThanOrEqual(screen.width - pad + 1e-6);
		}
	});

	it("starts below the vanishing line when the tilt is steep", () => {
		const steep = { pitch: 80, fov: 300, horizon: 0.6 };
		const vp = fitViewToScreen(view, screen, pad, steep);
		const vanishing = screen.height * steep.horizon - steep.fov / Math.tan((80 * Math.PI) / 180);
		const s = worldToScreen(0, 0, vp);
		const far = projectStagePoint(s.x, s.y, { ...steep, yaw: 0 }, screen);
		expect(far).not.toBeNull();
		expect(far?.y ?? 0).toBeGreaterThan(Math.max(pad, vanishing));
		expect(Number.isFinite(vp.zoom) && vp.zoom > 0).toBe(true);
	});

	it("fixed: pinned to the tilted fit", () => {
		const constrain = pinToViewConstraint({
			getRect: () => view,
			getSize: () => screen,
			padding: pad,
			getTilt: () => tilt,
		});
		expect(constrain({ x: 5, y: 5, zoom: 3 })).toEqual(fitViewToScreen(view, screen, pad, tilt));
	});

	it("zoom: stays on the fit until zoomed in, then may move as far as it zoomed", () => {
		const constrain = stayInViewConstraint({
			getRect: () => view,
			getSize: () => screen,
			padding: pad,
			getTilt: () => tilt,
		});
		const fit = fitViewToScreen(view, screen, pad, tilt);
		// Zoomed out and panned: back on the fit.
		const out = constrain({ x: 900, y: -400, zoom: fit.zoom / 3 });
		expect(out.zoom).toBeCloseTo(fit.zoom);
		expect(out.x).toBeCloseTo(fit.x);
		expect(out.y).toBeCloseTo(fit.y);
		// Zoomed in 2× and pushed far right: the point drawn where the fit draws the
		// view's centre stops a quarter of the view from it (half of the half size).
		const fx = fit.x + 800 * fit.zoom;
		const fy = fit.y + 450 * fit.zoom;
		const zoom = fit.zoom * 2;
		const pushed = constrain({ x: fx - 5000 * zoom, y: fy - 450 * zoom, zoom });
		expect(pushed.zoom).toBeCloseTo(zoom);
		expect((fx - pushed.x) / zoom).toBeCloseTo(800 + 400);
		expect((fy - pushed.y) / zoom).toBeCloseTo(450);
		// A move within the reach is left alone.
		const inside = { x: fx - 1000 * zoom, y: fy - 500 * zoom, zoom };
		expect(constrain(inside)).toEqual(inside);
	});

	it("applyViewCamera frames the view for the host's tilt", () => {
		const store = createBoardStore();
		let current: typeof tilt | null = tilt;
		const handle = applyViewCamera(store, () => view, "fixed", {
			getSize: () => screen,
			padding: pad,
			animate: false,
			getTilt: () => current,
		});
		expect(isAtView(store.getViewport(), view, screen, pad, tilt)).toBe(true);
		expect(isAtView(store.getViewport(), view, screen, pad)).toBe(false);
		// Read live: the tilt goes away, the next commit is the flat fit.
		current = null;
		store.setViewport({ x: 1, y: 1, zoom: 1 });
		expect(isAtView(store.getViewport(), view, screen, pad)).toBe(true);
		handle.release();
	});
});
