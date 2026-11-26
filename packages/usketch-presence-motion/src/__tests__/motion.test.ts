import { describe, expect, it } from "vitest";
import {
	type ActivityMotion,
	createMotionClock,
	MAX_KEYFRAMES,
	MAX_MOTION_MS,
	MAX_MOVES_PER_KEYFRAME,
	motionDuration,
	normalizeMotion,
	sampleMotion,
} from "../motion.js";

const linear = (keyframes: ActivityMotion["keyframes"]): ActivityMotion => ({
	id: "m1",
	keyframes,
	easing: "linear",
});

describe("sampleMotion", () => {
	const motion = linear([
		{ at: 0, cursor: { x: 0, y: 0 } },
		{ at: 100, cursor: { x: 100, y: 50 }, shapeIds: ["a"], action: "select" },
		{ at: 200, cursor: { x: 200, y: 50 }, shapeIds: ["a", "b"], action: "edit" },
	]);

	it("interpolates the cursor between keyframes", () => {
		expect(sampleMotion(motion, 50).cursor).toEqual({ x: 50, y: 25 });
		expect(sampleMotion(motion, 150).cursor).toEqual({ x: 150, y: 50 });
	});

	it("holds shapeIds and action until the next keyframe that sets them", () => {
		expect(sampleMotion(motion, 50).shapeIds).toEqual([]);
		expect(sampleMotion(motion, 100).shapeIds).toEqual(["a"]);
		expect(sampleMotion(motion, 199).shapeIds).toEqual(["a"]);
		expect(sampleMotion(motion, 199).action).toBe("select");
		expect(sampleMotion(motion, 200).shapeIds).toEqual(["a", "b"]);
		expect(sampleMotion(motion, 200).action).toBe("edit");
	});

	it("defaults action to edit before any keyframe sets it", () => {
		expect(sampleMotion(motion, 0).action).toBe("edit");
	});

	it("holds the final frame and reports done past the end", () => {
		const end = sampleMotion(motion, 10_000);
		expect(end.done).toBe(true);
		expect(end.cursor).toEqual({ x: 200, y: 50 });
		expect(end.shapeIds).toEqual(["a", "b"]);
		expect(sampleMotion(motion, 199).done).toBe(false);
	});

	it("shows no cursor before the first cursor keyframe", () => {
		const m = linear([
			{ at: 0, shapeIds: ["a"] },
			{ at: 100, cursor: { x: 10, y: 10 } },
		]);
		expect(sampleMotion(m, 50).cursor).toBeUndefined();
		expect(sampleMotion(m, 100).cursor).toEqual({ x: 10, y: 10 });
	});

	it("interpolates a marquee and ends it at a null keyframe without blending into it", () => {
		const m = linear([
			{ at: 0, marquee: { x: 0, y: 0, width: 0, height: 0 } },
			{ at: 100, marquee: { x: 0, y: 0, width: 100, height: 40 } },
			{ at: 200, marquee: null },
		]);
		expect(sampleMotion(m, 50).marquee).toEqual({ x: 0, y: 0, width: 50, height: 20 });
		expect(sampleMotion(m, 150).marquee).toEqual({ x: 0, y: 0, width: 100, height: 40 });
		expect(sampleMotion(m, 200).marquee).toBeUndefined();
	});

	it("eases in and out by default", () => {
		const m: ActivityMotion = {
			id: "e",
			keyframes: [
				{ at: 0, cursor: { x: 0, y: 0 } },
				{ at: 100, cursor: { x: 100, y: 0 } },
			],
		};
		expect(sampleMotion(m, 25).cursor?.x).toBeLessThan(25);
		expect(sampleMotion(m, 50).cursor?.x).toBeCloseTo(50);
		expect(sampleMotion(m, 75).cursor?.x).toBeGreaterThan(75);
	});

	it("clamps negative elapsed to the start", () => {
		expect(sampleMotion(motion, -50).cursor).toEqual({ x: 0, y: 0 });
	});
});

describe("sampleMotion moves (ghosts)", () => {
	const from = { x: 0, y: 0, width: 10, height: 10 };
	const mid = { x: 100, y: 0, width: 10, height: 10 };
	const to = { x: 100, y: 100, width: 20, height: 20 };
	const motion = linear([
		{ at: 0, cursor: { x: 0, y: 0 } },
		{ at: 100, moves: [{ shapeId: "a", box: from }] },
		{ at: 200, moves: [{ shapeId: "a", box: mid }] },
		{ at: 300, moves: [{ shapeId: "a", box: to }], shapeIds: ["a"] },
	]);

	it("shows no ghost before the shape's first move keyframe", () => {
		expect(sampleMotion(motion, 50).ghosts).toEqual([]);
	});

	it("interpolates the ghost through every move keyframe", () => {
		expect(sampleMotion(motion, 100).ghosts).toEqual([{ shapeId: "a", box: from }]);
		expect(sampleMotion(motion, 150).ghosts).toEqual([
			{ shapeId: "a", box: { x: 50, y: 0, width: 10, height: 10 } },
		]);
		expect(sampleMotion(motion, 250).ghosts).toEqual([
			{ shapeId: "a", box: { x: 100, y: 50, width: 15, height: 15 } },
		]);
	});

	it("drops the ghost on arrival (the real shape is already there)", () => {
		expect(sampleMotion(motion, 300).ghosts).toEqual([]);
		expect(sampleMotion(motion, 300).shapeIds).toEqual(["a"]);
	});

	it("tracks several shapes independently", () => {
		const m = linear([
			{ at: 0, moves: [{ shapeId: "a", box: from }] },
			{
				at: 100,
				moves: [
					{ shapeId: "a", box: mid },
					{ shapeId: "b", box: from },
				],
			},
			{ at: 200, moves: [{ shapeId: "b", box: mid }] },
		]);
		expect(sampleMotion(m, 50).ghosts.map((g) => g.shapeId)).toEqual(["a"]);
		expect(sampleMotion(m, 150).ghosts).toEqual([
			{ shapeId: "b", box: { x: 50, y: 0, width: 10, height: 10 } },
		]);
	});
});

describe("motionDuration", () => {
	it("is the time of the last keyframe", () => {
		expect(motionDuration(linear([{ at: 0 }, { at: 300 }, { at: 120 }]))).toBe(300);
	});
});

describe("normalizeMotion", () => {
	it("rejects non-motions", () => {
		expect(normalizeMotion(undefined)).toBeNull();
		expect(normalizeMotion({ id: "", keyframes: [{ at: 0 }] })).toBeNull();
		expect(normalizeMotion({ id: "x", keyframes: "nope" })).toBeNull();
		expect(normalizeMotion({ id: "x", keyframes: [{ at: "0" }] })).toBeNull();
	});

	it("drops malformed fields, clamps and sorts keyframes", () => {
		const m = normalizeMotion({
			id: "x",
			easing: "bogus",
			keyframes: [
				{ at: 500, cursor: { x: 1, y: Number.NaN }, shapeIds: ["a", 3], action: "fly" },
				{ at: -10, cursor: { x: 1, y: 2 }, marquee: { x: 0 } },
				{ at: 1e9, marquee: null },
			],
		});
		expect(m).toEqual({
			id: "x",
			easing: "ease-in-out",
			keyframes: [
				{ at: 0, cursor: { x: 1, y: 2 } },
				{ at: 500, shapeIds: ["a"] },
				{ at: MAX_MOTION_MS, marquee: null },
			],
		});
	});

	it("keeps valid moves and drops malformed ones", () => {
		const box = { x: 1, y: 2, width: 3, height: 4 };
		const m = normalizeMotion({
			id: "x",
			keyframes: [
				{
					at: 0,
					moves: [
						{ shapeId: "a", box },
						{ shapeId: 1, box },
						{ shapeId: "b", box: { x: 1 } },
						null,
					],
				},
				{ at: 10, moves: [{ shapeId: 2 }] },
			],
		});
		expect(m?.keyframes).toEqual([{ at: 0, moves: [{ shapeId: "a", box }] }, { at: 10 }]);
	});

	it("caps the moves per keyframe", () => {
		const box = { x: 0, y: 0, width: 1, height: 1 };
		const moves = Array.from({ length: MAX_MOVES_PER_KEYFRAME + 5 }, (_, i) => ({
			shapeId: `s${i}`,
			box,
		}));
		const m = normalizeMotion({ id: "x", keyframes: [{ at: 0, moves }] });
		expect(m?.keyframes[0].moves).toHaveLength(MAX_MOVES_PER_KEYFRAME);
	});

	it("caps the number of keyframes", () => {
		const keyframes = Array.from({ length: MAX_KEYFRAMES + 10 }, (_, i) => ({ at: i }));
		expect(normalizeMotion({ id: "x", keyframes })?.keyframes).toHaveLength(MAX_KEYFRAMES);
	});
});

describe("createMotionClock", () => {
	it("measures elapsed time per participant and restarts on a new motion id", () => {
		let now = 1000;
		const clock = createMotionClock(() => now);
		expect(clock.elapsed(2, "a")).toBe(0);
		now = 1250;
		expect(clock.elapsed(2, "a")).toBe(250);
		expect(clock.elapsed(3, "a")).toBe(0); // separate participant, separate clock
		expect(clock.elapsed(2, "b")).toBe(0); // new motion restarts
		now = 1300;
		expect(clock.elapsed(2, "b")).toBe(50);
	});

	it("forgets pruned participants", () => {
		let now = 0;
		const clock = createMotionClock(() => now);
		clock.elapsed(2, "a");
		now = 100;
		clock.prune(new Set());
		expect(clock.elapsed(2, "a")).toBe(0);
	});
});
