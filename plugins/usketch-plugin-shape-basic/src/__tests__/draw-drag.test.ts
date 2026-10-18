import { describe, expect, it } from "vitest";
import { getDrawDragPatch } from "../draw-drag.js";

describe("getDrawDragPatch", () => {
	it("normalizes the drag rect for any subtype", () => {
		expect(getDrawDragPatch("rectangle", { x: 100, y: 100 }, { x: 40, y: 160 })).toEqual({
			x: 40,
			y: 100,
			width: 60,
			height: 60,
		});
	});

	it("sets an arrow's direction from the dominant drag axis and sign", () => {
		const start = { x: 100, y: 100 };
		expect(getDrawDragPatch("arrow", start, { x: 10, y: 120 }).direction).toBe("left");
		expect(getDrawDragPatch("arrow", start, { x: 120, y: 10 }).direction).toBe("up");
		expect(getDrawDragPatch("arrow", start, { x: 120, y: 300 }).direction).toBe("down");
		expect(getDrawDragPatch("arrow", start, { x: 300, y: 120 }).direction).toBe("right");
	});
});
