import { describe, expect, it } from "vitest";
import { getImageAspect, resizeImageShape } from "../image-resize.js";
import type { ImageShapeData } from "../types.js";

const base: ImageShapeData = {
	id: "img",
	type: "image",
	x: 0,
	y: 0,
	width: 200,
	height: 100,
	style: { fill: "#f5f5f5", stroke: "#e0e0e0", strokeWidth: 1, opacity: 1 },
	src: "",
};

describe("getImageAspect", () => {
	it("prefers the stored ratio", () => {
		expect(getImageAspect({ ...base, aspectRatio: 1.5 })).toBe(1.5);
	});
	it("falls back to the box ratio, then 1", () => {
		expect(getImageAspect(base)).toBe(2);
		expect(getImageAspect({ ...base, width: 0 })).toBe(1);
	});
});

describe("resizeImageShape", () => {
	it("locks the ratio by default", () => {
		const out = resizeImageShape(base, "se", { x: 100, y: 0 }) as ImageShapeData;
		expect(out.width).toBe(300);
		expect(out.height).toBe(150);
	});

	it("records the pre-drag ratio on shapes that have none", () => {
		const out = resizeImageShape(base, "se", { x: 100, y: 0 }) as ImageShapeData;
		expect(out.aspectRatio).toBe(2);
	});

	it("keeps the stored ratio after a flip zeroed the box", () => {
		const flipped = { ...base, width: 0, aspectRatio: 2 };
		const out = resizeImageShape(flipped, "e", { x: 120, y: 0 });
		expect(out.width).toBe(120);
		expect(out.height).toBe(60);
	});

	it("resizes axes independently in free mode", () => {
		const out = resizeImageShape({ ...base, resizeMode: "free" }, "se", { x: 100, y: 0 });
		expect(out.width).toBe(300);
		expect(out.height).toBe(100);
		expect((out as ImageShapeData).aspectRatio).toBeUndefined();
	});

	it("clamps to the 40px minimum without distorting", () => {
		const out = resizeImageShape(base, "se", { x: -1000, y: 0 });
		expect(out.height).toBe(40);
		expect(out.width).toBe(80);
	});
});
