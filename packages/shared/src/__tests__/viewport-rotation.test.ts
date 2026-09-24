import { describe, expect, it } from "vitest";
import type { Viewport } from "../index.js";
import {
	overlayFrameStyle,
	screenRectToWorldBounds,
	screenToOverlay,
	screenToWorld,
	unrotatedViewport,
	viewportAnchoredAt,
	viewportTransformStyle,
	worldToScreen,
} from "../utils/geometry.js";
import { shortestAngleDelta, wrapDeg } from "../utils/rotation.js";

const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
	expect(a.x).toBeCloseTo(b.x, 9);
	expect(a.y).toBeCloseTo(b.y, 9);
};

describe("viewport transform — unrotated regression", () => {
	const vp: Viewport = { x: 30, y: -12, zoom: 1.5 };
	it("matches the plain translate+scale formulas exactly", () => {
		expect(worldToScreen(10, 20, vp)).toEqual({ x: 10 * 1.5 + 30, y: 20 * 1.5 - 12 });
		expect(screenToWorld(45, 18, vp)).toEqual({ x: (45 - 30) / 1.5, y: (18 + 12) / 1.5 });
	});
	it("treats rotation 0 / non-finite as unrotated", () => {
		expect(worldToScreen(10, 20, { ...vp, rotation: 0 })).toEqual(worldToScreen(10, 20, vp));
		expect(worldToScreen(10, 20, { ...vp, rotation: Number.NaN })).toEqual(
			worldToScreen(10, 20, vp),
		);
	});
	it("keeps the legacy CSS transform string", () => {
		expect(viewportTransformStyle(vp)).toBe("translate(30px, -12px) scale(1.5)");
	});
	it("keeps the legacy visible-bounds rect", () => {
		expect(screenRectToWorldBounds(300, 150, vp)).toEqual({
			x: -30 / 1.5,
			y: 12 / 1.5,
			width: 300 / 1.5,
			height: 150 / 1.5,
		});
	});
});

describe("viewport transform — rotated", () => {
	const vp: Viewport = { x: 100, y: 50, zoom: 2, rotation: 90 };
	it("rotates about the screen origin, clockwise-positive", () => {
		// world (1,0) → zoom → (2,0) → rotate 90° cw (y-down) → (0,2) → + t
		close(worldToScreen(1, 0, vp), { x: 100, y: 52 });
	});
	it("round-trips world ↔ screen at arbitrary angles", () => {
		for (const rotation of [-170, -45, 13, 90, 179.5]) {
			const v: Viewport = { x: -40, y: 75, zoom: 0.7, rotation };
			const s = worldToScreen(123, -456, v);
			close(screenToWorld(s.x, s.y, v), { x: 123, y: -456 });
		}
	});
	it("emits a rotate() in the CSS transform", () => {
		expect(viewportTransformStyle(vp)).toBe("translate(100px, 50px) rotate(90deg) scale(2)");
	});
	it("visible bounds cover every screen corner", () => {
		const b = screenRectToWorldBounds(400, 200, vp);
		for (const [sx, sy] of [
			[0, 0],
			[400, 0],
			[0, 200],
			[400, 200],
		]) {
			const w = screenToWorld(sx, sy, vp);
			expect(w.x).toBeGreaterThanOrEqual(b.x - 1e-9);
			expect(w.y).toBeGreaterThanOrEqual(b.y - 1e-9);
			expect(w.x).toBeLessThanOrEqual(b.x + b.width + 1e-9);
			expect(w.y).toBeLessThanOrEqual(b.y + b.height + 1e-9);
		}
	});
});

describe("viewportAnchoredAt", () => {
	it("places the world point at the screen point (any rotation)", () => {
		for (const rotation of [0, 30, -120]) {
			const vp = viewportAnchoredAt({ x: 500, y: -200 }, { x: 640, y: 360 }, 1.25, rotation);
			close(worldToScreen(500, -200, vp), { x: 640, y: 360 });
		}
	});
	it("omits the rotation key when unrotated", () => {
		expect(viewportAnchoredAt({ x: 1, y: 2 }, { x: 0, y: 0 }, 1)).toEqual({
			x: -1,
			y: -2,
			zoom: 1,
		});
	});
});

describe("wrapDeg / shortestAngleDelta", () => {
	it("wraps into (-180, 180]", () => {
		expect(wrapDeg(0)).toBe(0);
		expect(wrapDeg(-0)).toBe(0);
		expect(wrapDeg(180)).toBe(180);
		expect(wrapDeg(-180)).toBe(180);
		expect(wrapDeg(190)).toBe(-170);
		expect(wrapDeg(720 + 45)).toBe(45);
		expect(wrapDeg(-450)).toBe(-90);
		expect(wrapDeg(Number.NaN)).toBe(0);
	});
	it("takes the short way round", () => {
		expect(shortestAngleDelta(170, -170)).toBe(20);
		expect(shortestAngleDelta(-170, 170)).toBe(-20);
		expect(shortestAngleDelta(10, 350)).toBe(-20);
	});
});

describe("overlay frame", () => {
	const vp: Viewport = { x: 310, y: -45, zoom: 1.3, rotation: -37 };
	it("unrotated overlay positions, turned about (x, y), land on the true screen point", () => {
		const style = overlayFrameStyle(vp);
		expect(style).toEqual({ transform: "rotate(-37deg)", transformOrigin: "310px -45px" });
		const flat = unrotatedViewport(vp);
		const w = { x: 123, y: 456 };
		const o = worldToScreen(w.x, w.y, flat); // what overlay code computes
		// Apply the wrapper: rotate o about (vp.x, vp.y).
		const rad = (-37 * Math.PI) / 180;
		const dx = o.x - vp.x;
		const dy = o.y - vp.y;
		const shown = {
			x: vp.x + dx * Math.cos(rad) - dy * Math.sin(rad),
			y: vp.y + dx * Math.sin(rad) + dy * Math.cos(rad),
		};
		close(shown, worldToScreen(w.x, w.y, vp));
	});
	it("screenToOverlay maps a real screen point back into the overlay frame", () => {
		const s = worldToScreen(-20, 77, vp);
		close(screenToOverlay(s.x, s.y, vp), worldToScreen(-20, 77, unrotatedViewport(vp)));
	});
	it("is the identity without rotation", () => {
		const flat: Viewport = { x: 5, y: 6, zoom: 2 };
		expect(overlayFrameStyle(flat)).toBeNull();
		expect(unrotatedViewport(flat)).toBe(flat);
		expect(screenToOverlay(9, 8, flat)).toEqual({ x: 9, y: 8 });
	});
});
