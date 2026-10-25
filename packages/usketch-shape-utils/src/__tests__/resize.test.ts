import type { ResizeHandle, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createAspectResize } from "../resize.js";

const base: ShapeData = {
	id: "s1",
	type: "rect",
	x: 100,
	y: 100,
	width: 200,
	height: 100, // aspect 2
	style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
};

const resize = createAspectResize(() => 2, { minWidth: 40, minHeight: 40 });

describe("createAspectResize", () => {
	const handles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
	for (const handle of handles) {
		it(`keeps the ratio on the ${handle} handle`, () => {
			const out = resize(base, handle, { x: 37, y: 23 });
			expect(out.width / out.height).toBeCloseTo(2, 6);
		});
	}

	it("anchors the opposite corner (nw keeps bottom-right fixed)", () => {
		const out = resize(base, "nw", { x: -50, y: 0 });
		expect(out.width).toBeCloseTo(250, 6);
		expect(out.x + out.width).toBeCloseTo(300, 6);
		expect(out.y + out.height).toBeCloseTo(200, 6);
	});

	it("drives the size from the height on n/s and keeps x centered", () => {
		const out = resize(base, "s", { x: 0, y: 50 });
		expect(out.height).toBeCloseTo(150, 6);
		expect(out.width).toBeCloseTo(300, 6);
		expect(out.x + out.width / 2).toBeCloseTo(200, 6);
		expect(out.y).toBe(100);
	});

	it("keeps y centered on e/w", () => {
		const out = resize(base, "e", { x: 100, y: 0 });
		expect(out.y + out.height / 2).toBeCloseTo(150, 6);
		expect(out.x).toBe(100);
	});

	it("applies min height along the ratio (no distortion)", () => {
		const tall = createAspectResize(() => 0.5, { minWidth: 40, minHeight: 40 });
		const out = tall({ ...base, width: 100, height: 200 }, "se", { x: -1000, y: 0 });
		expect(out.width).toBeCloseTo(40, 6);
		expect(out.height).toBeCloseTo(80, 6);
		const wide = resize(base, "se", { x: -1000, y: 0 });
		expect(wide.height).toBeCloseTo(40, 6);
		expect(wide.width).toBeCloseTo(80, 6);
	});

	it("falls back to the current ratio when getAspect returns 0", () => {
		const fallback = createAspectResize(() => 0);
		const out = fallback(base, "se", { x: 100, y: 0 });
		expect(out.width / out.height).toBeCloseTo(2, 6);
	});
});
