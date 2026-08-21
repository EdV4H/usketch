import { describe, expect, it } from "vitest";
import { gestureStep, pointerDistance, pointerMidpoint } from "../gesture.js";

describe("pointerDistance / pointerMidpoint", () => {
	it("computes distance and midpoint", () => {
		expect(pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
		expect(pointerMidpoint({ x: 0, y: 0 }, { x: 4, y: 8 })).toEqual({ x: 2, y: 4 });
	});
});

describe("gestureStep", () => {
	it("pure pinch-out (2x apart, same centre) → scale 2, no pan", () => {
		// prev pointers 10 apart around (50,50); next 20 apart around (50,50).
		const s = gestureStep({ x: 45, y: 50 }, { x: 55, y: 50 }, { x: 40, y: 50 }, { x: 60, y: 50 });
		expect(s.scale).toBe(2);
		expect(s.panX).toBe(0);
		expect(s.panY).toBe(0);
		expect(s.centerX).toBe(50);
		expect(s.centerY).toBe(50);
	});

	it("pure pan (both pointers translate) → scale 1, pan = translation", () => {
		const s = gestureStep({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 7 }, { x: 15, y: 7 });
		expect(s.scale).toBe(1); // distance unchanged (10)
		expect(s.panX).toBe(5);
		expect(s.panY).toBe(7);
		expect(s.centerX).toBe(10); // new midpoint
		expect(s.centerY).toBe(7);
	});

	it("pinch-in halves the scale", () => {
		const s = gestureStep({ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 5, y: 0 }, { x: 15, y: 0 });
		expect(s.scale).toBe(0.5);
	});

	it("degenerate previous distance (coincident) → scale 1 (no-op frame)", () => {
		const s = gestureStep({ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 0, y: 0 }, { x: 20, y: 0 });
		expect(s.scale).toBe(1);
	});
});
