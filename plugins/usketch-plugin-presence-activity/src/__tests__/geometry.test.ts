import type { BoundingBox, Viewport } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { fallbackColor, unionBounds, worldRectToScreen } from "../geometry.js";

const vp = (x: number, y: number, zoom: number): Viewport => ({ x, y, zoom }) as Viewport;
const box = (x: number, y: number, width: number, height: number): BoundingBox => ({
	x,
	y,
	width,
	height,
});

describe("worldRectToScreen", () => {
	it("applies the same translate+scale the canvas uses", () => {
		expect(worldRectToScreen(box(10, 20, 30, 40), vp(5, 7, 2))).toEqual({
			x: 25,
			y: 47,
			width: 60,
			height: 80,
		});
	});
	it("is identity at zoom 1 / origin 0", () => {
		expect(worldRectToScreen(box(3, 4, 5, 6), vp(0, 0, 1))).toEqual(box(3, 4, 5, 6));
	});
});

describe("unionBounds", () => {
	it("returns null for no boxes", () => {
		expect(unionBounds([])).toBeNull();
	});
	it("encloses all boxes", () => {
		expect(unionBounds([box(0, 0, 10, 10), box(20, 5, 10, 30)])).toEqual({
			x: 0,
			y: 0,
			width: 30,
			height: 35,
		});
	});
	it("passes a single box through", () => {
		expect(unionBounds([box(4, 4, 2, 2)])).toEqual(box(4, 4, 2, 2));
	});
});

describe("fallbackColor", () => {
	it("is deterministic per clientId", () => {
		expect(fallbackColor(3)).toBe(fallbackColor(3));
	});
	it("stays in palette for negative ids", () => {
		expect(typeof fallbackColor(-7)).toBe("string");
	});
});
