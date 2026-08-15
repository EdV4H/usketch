import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { simplifiedPageStyle } from "../pdf-page-shape.js";

function shape(overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: "p1",
		type: "pdf-page",
		x: 10,
		y: 20,
		width: 339,
		height: 480,
		style: { fill: "#ffffff", stroke: "#e0e0e0", strokeWidth: 1, opacity: 1 },
		...overrides,
	};
}

describe("simplifiedPageStyle", () => {
	it("positions itself in world coordinates", () => {
		// The LOD component replaces the positioned wrapper, so it must place itself.
		expect(simplifiedPageStyle(shape())).toMatchObject({
			position: "absolute",
			left: 10,
			top: 20,
			width: 339,
			height: 480,
		});
	});

	it("applies the shape's rotation about its center", () => {
		// The wrapper that normally rotates the shape is gone in LOD, so a rotated
		// page would otherwise snap upright when zoomed out or panned off-screen.
		expect(simplifiedPageStyle(shape({ rotation: 30 }))).toMatchObject({
			transform: "rotate(30deg)",
			transformOrigin: "center center",
		});
	});

	it("omits the transform when the page is not rotated", () => {
		expect(simplifiedPageStyle(shape()).transform).toBeUndefined();
		expect(simplifiedPageStyle(shape({ rotation: 0 })).transform).toBeUndefined();
	});

	it("ignores a non-finite rotation rather than emitting a broken transform", () => {
		expect(simplifiedPageStyle(shape({ rotation: Number.NaN })).transform).toBeUndefined();
	});
});
