import { describe, expect, it } from "vitest";
import {
	aiMotionDuration,
	buildAiMotion,
	finalCursor,
	HOP_MS,
	MAX_MOTION_MS,
	visitShapes,
} from "../ai-motion.js";

const box = (x: number, y: number) => ({ x, y, width: 20, height: 10 });

describe("visitShapes", () => {
	it("visits each shape's centre and accumulates the outline set", () => {
		expect(
			visitShapes([
				{ id: "a", box: box(0, 0) },
				{ id: "b", box: box(100, 0) },
			]),
		).toEqual([
			{ cursor: { x: 10, y: 5 }, shapeIds: ["a"] },
			{ cursor: { x: 110, y: 5 }, shapeIds: ["a", "b"] },
		]);
	});
});

describe("buildAiMotion", () => {
	const stops = visitShapes([
		{ id: "a", box: box(0, 0) },
		{ id: "b", box: box(100, 0) },
	]);

	it("returns null with nothing to visit", () => {
		expect(buildAiMotion({ id: "m", stops: [] })).toBeNull();
	});

	it("starts from the previous cursor position and hops to each stop", () => {
		const m = buildAiMotion({ id: "m", stops, from: { x: -50, y: -50 } });
		expect(m?.keyframes).toEqual([
			{ at: 0, cursor: { x: -50, y: -50 } },
			{ at: HOP_MS, cursor: { x: 10, y: 5 }, shapeIds: ["a"], action: "edit" },
			{ at: HOP_MS * 2, cursor: { x: 110, y: 5 }, shapeIds: ["a", "b"], action: "edit" },
		]);
	});

	it("starts at the first stop when the previous cursor is unknown", () => {
		const m = buildAiMotion({ id: "m", stops, action: "select" });
		expect(m?.keyframes[0]).toEqual({
			at: 0,
			cursor: { x: 10, y: 5 },
			shapeIds: ["a"],
			action: "select",
		});
		expect(m && aiMotionDuration(m)).toBe(HOP_MS);
	});

	it("speeds up hops so a long tour stays within MAX_MOTION_MS", () => {
		const many = visitShapes(
			Array.from({ length: 50 }, (_, i) => ({ id: `s${i}`, box: box(i, 0) })),
		);
		const m = buildAiMotion({ id: "m", stops: many, from: { x: 0, y: 0 } });
		expect(m && aiMotionDuration(m)).toBeLessThanOrEqual(MAX_MOTION_MS);
	});

	it("moves only the cursor for stops without shapes", () => {
		const m = buildAiMotion({ id: "m", stops: [{ cursor: { x: 5, y: 5 } }], from: { x: 0, y: 0 } });
		expect(m?.keyframes[1]).toEqual({ at: HOP_MS, cursor: { x: 5, y: 5 } });
		expect(m && finalCursor(m)).toEqual({ x: 5, y: 5 });
	});
});
