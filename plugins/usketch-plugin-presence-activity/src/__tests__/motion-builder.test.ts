import { describe, expect, it } from "vitest";
import { MAX_MOTION_MS, motionDuration, sampleMotion } from "../motion.js";
import {
	buildMotion,
	DEFAULT_MOTION_TOUR_MS,
	DEFAULT_MOTION_HOP_MS as HOP_MS,
	motionFinalCursor,
	motionStopTimes,
	visitShapes,
} from "../motion-builder.js";

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

describe("buildMotion", () => {
	const stops = visitShapes([
		{ id: "a", box: box(0, 0) },
		{ id: "b", box: box(100, 0) },
	]);

	it("returns null with nothing to visit", () => {
		expect(buildMotion({ id: "m", stops: [] })).toBeNull();
	});

	it("starts from the previous cursor position and hops to each stop", () => {
		const m = buildMotion({ id: "m", stops, from: { x: -50, y: -50 } });
		expect(m?.keyframes).toEqual([
			{ at: 0, cursor: { x: -50, y: -50 } },
			{ at: HOP_MS, cursor: { x: 10, y: 5 }, shapeIds: ["a"], action: "edit" },
			{ at: HOP_MS * 2, cursor: { x: 110, y: 5 }, shapeIds: ["a", "b"], action: "edit" },
		]);
	});

	it("starts at the first stop when the previous cursor is unknown", () => {
		const m = buildMotion({ id: "m", stops, action: "select" });
		expect(m?.keyframes[0]).toEqual({
			at: 0,
			cursor: { x: 10, y: 5 },
			shapeIds: ["a"],
			action: "select",
		});
		expect(m && motionDuration(m)).toBe(HOP_MS);
	});

	it("speeds up hops so a long tour stays within DEFAULT_MOTION_TOUR_MS", () => {
		const many = visitShapes(
			Array.from({ length: 50 }, (_, i) => ({ id: `s${i}`, box: box(i, 0) })),
		);
		const m = buildMotion({ id: "m", stops: many, from: { x: 0, y: 0 } });
		expect(m && motionDuration(m)).toBeLessThanOrEqual(DEFAULT_MOTION_TOUR_MS);
	});

	it("moves only the cursor for stops without shapes", () => {
		const m = buildMotion({ id: "m", stops: [{ cursor: { x: 5, y: 5 } }], from: { x: 0, y: 0 } });
		expect(m?.keyframes[1]).toEqual({ at: HOP_MS, cursor: { x: 5, y: 5 } });
		expect(m && motionFinalCursor(m)).toEqual({ x: 5, y: 5 });
	});

	it("drags a moved shape from its old box to its new one", () => {
		const before = { x: 0, y: 0, width: 20, height: 10 };
		const after = { x: 200, y: 100, width: 20, height: 10 };
		const moved = visitShapes([{ id: "a", box: after, from: before }]);
		expect(moved[0].move).toEqual({ shapeId: "a", from: before, to: after });

		const m = buildMotion({ id: "m", stops: moved, from: { x: -50, y: -50 } });
		expect(m?.keyframes).toEqual([
			{ at: 0, cursor: { x: -50, y: -50 } },
			{ at: HOP_MS, cursor: { x: 10, y: 5 }, moves: [{ shapeId: "a", box: before }] },
			{
				at: HOP_MS * 2,
				cursor: { x: 210, y: 105 },
				shapeIds: ["a"],
				action: "edit",
				moves: [{ shapeId: "a", box: after }],
			},
		]);
	});

	it("does not drag a shape whose box did not change", () => {
		const b = box(0, 0);
		expect(visitShapes([{ id: "a", box: b, from: { ...b } }])[0].move).toBeUndefined();
	});

	it("takes custom hop and tour lengths", () => {
		const m = buildMotion({ id: "m", stops, from: { x: 0, y: 0 }, hopMs: 100, maxDurationMs: 150 });
		expect(m?.keyframes.map((k) => k.at)).toEqual([0, 75, 150]);
	});

	it("falls back to the defaults for bad lengths and never exceeds the receivers' limit", () => {
		const bad = buildMotion({
			id: "m",
			stops,
			from: { x: 0, y: 0 },
			hopMs: Number.NaN,
			maxDurationMs: -1,
		});
		expect(bad?.keyframes.map((k) => k.at)).toEqual([0, HOP_MS, HOP_MS * 2]);
		const long = visitShapes(
			Array.from({ length: 200 }, (_, i) => ({ id: `s${i}`, box: box(i, 0) })),
		);
		const m = buildMotion({ id: "m", stops: long, hopMs: 1000, maxDurationMs: 300_000 });
		expect(m && motionDuration(m)).toBeLessThanOrEqual(MAX_MOTION_MS);
	});

	it("treats a null starting cursor like a missing one", () => {
		const m = buildMotion({ id: "m", stops, from: null });
		expect(m?.keyframes.map((k) => k.at)).toEqual([0, HOP_MS]);
		expect(motionStopTimes(stops, { from: null })).toEqual([0, HOP_MS]);
	});

	it("plays back through sampleMotion to the last stop", () => {
		const m = buildMotion({ id: "m", stops, from: { x: -50, y: -50 } });
		if (!m) throw new Error("expected a motion");
		const end = sampleMotion(m, motionDuration(m));
		expect(end).toMatchObject({ cursor: { x: 110, y: 5 }, shapeIds: ["a", "b"], done: true });
	});
});

describe("motionStopTimes", () => {
	const stops = visitShapes([
		{ id: "a", box: box(0, 0) },
		{ id: "b", box: box(100, 0), from: box(0, 100) },
		{ id: "c", box: box(200, 0) },
	]);

	it.each([
		["with a starting cursor", { x: -50, y: -50 }],
		["without one", undefined],
	])("matches the keyframe where each stop's outline appears (%s)", (_, from) => {
		const m = buildMotion({ id: "m", stops, from });
		const arrivals = m?.keyframes.filter((k) => k.shapeIds).map((k) => k.at);
		expect(motionStopTimes(stops, { from })).toEqual(arrivals);
	});

	it("is empty without stops", () => {
		expect(motionStopTimes([])).toEqual([]);
	});
});
