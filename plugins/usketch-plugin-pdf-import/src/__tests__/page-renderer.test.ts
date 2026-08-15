import { describe, expect, it } from "vitest";
import { containSize, isCancellation, targetRenderWidth } from "../page-renderer.js";

const MAX = 4096;

describe("targetRenderWidth", () => {
	it("scales the render buffer with the zoom level", () => {
		const at1 = targetRenderWidth(339, 1, 1, MAX);
		const at4 = targetRenderWidth(339, 4, 1, MAX);
		expect(at4).toBeGreaterThan(at1);
		expect(at4 / at1).toBe(4);
	});

	it("accounts for the device pixel ratio", () => {
		expect(targetRenderWidth(339, 1, 2, MAX)).toBe(targetRenderWidth(339, 2, 1, MAX));
	});

	it("quantizes to powers of two so a pinch gesture triggers few re-renders", () => {
		// Every zoom in this range wants a buffer between 512 and 1024 px.
		const widths = [1.6, 1.8, 2.0, 2.4, 2.8].map((zoom) => targetRenderWidth(339, zoom, 1, MAX));
		expect(new Set(widths).size).toBe(1);
		expect(Number.isInteger(Math.log2(widths[0] ?? 0))).toBe(true);
	});

	it("never renders below the legibility floor", () => {
		expect(targetRenderWidth(339, 0.01, 1, MAX)).toBe(128);
	});

	it("caps the buffer so a deep zoom cannot allocate an unbounded canvas", () => {
		expect(targetRenderWidth(339, 1000, 2, MAX)).toBe(MAX);
	});

	it("honours a lowered cap", () => {
		expect(targetRenderWidth(339, 100, 1, 1024)).toBe(1024);
	});

	it("grows with the shape's own size, so a resized page stays sharp", () => {
		expect(targetRenderWidth(1000, 1, 1, MAX)).toBeGreaterThan(targetRenderWidth(339, 1, 1, MAX));
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
