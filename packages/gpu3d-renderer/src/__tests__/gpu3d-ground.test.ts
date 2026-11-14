import { describe, expect, it } from "vitest";
import { groundRegionPx, parseCssColor, stageRectWorld } from "../gpu3d-ground.js";

describe("groundRegionPx", () => {
	it("is the stage box without a draw distance", () => {
		expect(groundRegionPx(0, 1, 800, 600)).toEqual({ left: 0, top: 0, right: 800, bottom: 600 });
	});

	it("cuts to the near band when the draw distance is short", () => {
		// 200 world units at zoom 2 = 400 px of the 600 px stage.
		expect(groundRegionPx(200, 2, 800, 600)).toEqual({
			left: 0,
			top: 200,
			right: 800,
			bottom: 600,
		});
		// Half-way into 3D: half the cut.
		expect(groundRegionPx(200, 2, 800, 600, 0.5).top).toBe(100);
	});

	it("grows past the box when the draw distance is long", () => {
		expect(groundRegionPx(1000, 1, 800, 600)).toEqual({
			left: -400,
			top: -400,
			right: 1200,
			bottom: 1000,
		});
	});
});

describe("stageRectWorld", () => {
	it("gives the world corners clockwise from top-left", () => {
		const corners = stageRectWorld(
			{ left: 0, top: 0, right: 100, bottom: 50 },
			{ x: 10, y: 20, zoom: 2 },
		);
		expect(corners).toEqual([
			{ x: -5, y: -10 },
			{ x: 45, y: -10 },
			{ x: 45, y: 15 },
			{ x: -5, y: 15 },
		]);
	});
});

describe("parseCssColor", () => {
	it("reads rgb / rgba as premultiplied", () => {
		expect(parseCssColor("rgb(255, 0, 51)")).toEqual([1, 0, 0.2, 1]);
		expect(parseCssColor("rgba(255, 255, 255, 0.5)")).toEqual([0.5, 0.5, 0.5, 0.5]);
		expect(parseCssColor("rgb(0 0 0 / 0)")).toEqual([0, 0, 0, 0]);
	});

	it("reads hex", () => {
		expect(parseCssColor("#fff")).toEqual([1, 1, 1, 1]);
		expect(parseCssColor("#000000")).toEqual([0, 0, 0, 1]);
	});

	it("gives null for what it can't read", () => {
		expect(parseCssColor("")).toBeNull();
		expect(parseCssColor("red")).toBeNull();
		expect(parseCssColor("rgb(a, b)")).toBeNull();
	});
});
