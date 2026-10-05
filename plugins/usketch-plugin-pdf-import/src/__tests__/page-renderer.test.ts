import { describe, expect, it } from "vitest";
import { containSize, isCancellation, targetRenderWidth } from "../page-renderer.js";

/** Plenty for every zoom below that does not test the cap itself. */
const MAX = 64_000_000;
/** A4 portrait: height / width. */
const A4 = 842 / 595;

describe("targetRenderWidth", () => {
	it("scales the render buffer with the zoom level", () => {
		const at1 = targetRenderWidth(339, 1, 1, MAX, A4);
		const at4 = targetRenderWidth(339, 4, 1, MAX, A4);
		expect(at4).toBeGreaterThan(at1);
		expect(at4 / at1).toBe(4);
	});

	it("accounts for the device pixel ratio", () => {
		expect(targetRenderWidth(339, 1, 2, MAX, A4)).toBe(targetRenderWidth(339, 2, 1, MAX, A4));
	});

	it("quantizes to powers of two so a pinch gesture triggers few re-renders", () => {
		// Every zoom in this range wants a buffer between 512 and 1024 px.
		const widths = [1.6, 1.8, 2.0, 2.4, 2.8].map((zoom) =>
			targetRenderWidth(339, zoom, 1, MAX, A4),
		);
		expect(new Set(widths).size).toBe(1);
		expect(Number.isInteger(Math.log2(widths[0] ?? 0))).toBe(true);
	});

	it("never renders below the legibility floor", () => {
		expect(targetRenderWidth(339, 0.01, 1, MAX, A4)).toBe(128);
	});

	it("caps the buffer's area, not just its width, at a deep zoom", () => {
		const cap = 8_000_000;
		const width = targetRenderWidth(339, 1000, 2, cap, A4);
		// A width-only cap would let the derived height take the area past it
		// (4096 wide A4 is 4096 × 5796 ≈ 23.7M px).
		expect(width * Math.round(width * A4)).toBeLessThanOrEqual(cap);
		expect(width).toBeGreaterThan(2048);
	});

	it("gives a tall page a narrower buffer than a wide one under the same cap", () => {
		const cap = 4_000_000;
		const portrait = targetRenderWidth(339, 1000, 2, cap, A4);
		const landscape = targetRenderWidth(339, 1000, 2, cap, 1 / A4);
		expect(portrait).toBeLessThan(landscape);
	});

	it("treats an unknown aspect ratio as square instead of failing", () => {
		expect(targetRenderWidth(339, 1000, 1, 1_048_576, Number.NaN)).toBe(1024);
		expect(targetRenderWidth(339, 1000, 1, 1_048_576, 0)).toBe(1024);
	});

	it("grows with the shape's own size, so a resized page stays sharp", () => {
		expect(targetRenderWidth(1000, 1, 1, MAX, A4)).toBeGreaterThan(
			targetRenderWidth(339, 1, 1, MAX, A4),
		);
	});
});

describe("containSize", () => {
	it("letterboxes a portrait page inside a wider box", () => {
		expect(containSize(400, 400, 595, 842)).toEqual({
			width: (400 / 842) * 595,
			height: 400,
		});
	});

	it("pillarboxes a landscape page inside a taller box", () => {
		expect(containSize(400, 400, 842, 595)).toEqual({
			width: 400,
			height: (400 / 842) * 595,
		});
	});

	it("fills the box almost exactly when the aspect ratios match", () => {
		const fit = containSize(339, 480, 595, 842);
		expect(fit.width).toBeCloseTo(339, 0);
		expect(fit.height).toBeCloseTo(480, 0);
	});

	it("falls back to the box when the page size is unknown", () => {
		expect(containSize(300, 200, 0, 0)).toEqual({ width: 300, height: 200 });
	});
});

describe("isCancellation", () => {
	it("recognises both our own aborts and pdf.js cancellations", () => {
		expect(isCancellation(Object.assign(new Error(""), { name: "AbortError" }))).toBe(true);
		expect(
			isCancellation(Object.assign(new Error(""), { name: "RenderingCancelledException" })),
		).toBe(true);
	});

	it("does not swallow real failures", () => {
		expect(isCancellation(new Error("boom"))).toBe(false);
		expect(isCancellation(undefined)).toBe(false);
	});
});
