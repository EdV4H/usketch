import { describe, expect, it } from "vitest";
import { AIR_LEAN_FADE, bodyLeanFactor, slopeTiltTransform } from "../character-layer.js";
import {
	type CharacterPose,
	constrainToGround,
	DEFAULT_JUMP,
	DEFAULT_MOTION,
	groundSlope,
	type HeightAt,
	IDLE_JUMP,
	NO_INPUT,
	ORIGIN_POSE,
	pushInAir,
	SLIDE_SPEED,
	slideOnSteep,
	stepVertical,
	sweepToGround,
	takeoffVelocity,
} from "../character-physics.js";
import { createCharacterStore } from "../character-store.js";

const at = (x: number, y: number, extra: Partial<CharacterPose> = {}): CharacterPose => ({
	...ORIGIN_POSE,
	x,
	y,
	...extra,
});

/** A 45° ramp rising toward +x. */
const ramp: HeightAt = (x) => Math.max(0, x);
/** A gentle ramp (about 11°). */
const gentle: HeightAt = (x) => Math.max(0, x * 0.2);
/** The map's terrain: flat cells, a 16-high step at x = 32. */
const steps: HeightAt = (x) => (x >= 32 ? 16 : 0);

describe("groundSlope", () => {
	it("reads a smooth slope as its gradient, and a step next to the point as flat", () => {
		expect(groundSlope(ramp, 50, 0)).toEqual({ x: 1, y: 0 });
		expect(groundSlope(gentle, 50, 7).x).toBeCloseTo(0.2, 6);
		expect(groundSlope(steps, 30, 0)).toEqual({ x: 0, y: 0 });
		expect(groundSlope(steps, 33, 0)).toEqual({ x: 0, y: 0 });
	});
});

describe("maxSlope", () => {
	it("blocks walking up ground steeper than the limit, not down it or across it", () => {
		const from = at(50, 0);
		expect(constrainToGround(from, at(52, 0), ramp, 24, 40)).toMatchObject({
			x: 50,
			moving: false,
		});
		expect(constrainToGround(from, at(48, 0), ramp, 24, 40)).toMatchObject({ x: 48 });
		expect(constrainToGround(from, at(50, 2), ramp, 24, 40)).toMatchObject({ y: 2 });
		// Diagonally into it: slides along (keeps the across part).
		expect(constrainToGround(from, at(52, 1), ramp, 24, 40)).toMatchObject({ x: 50, y: 1 });
	});

	it("lets gentle slopes, no limit, and the air through", () => {
		expect(constrainToGround(at(50, 0), at(52, 0), gentle, 24, 40)).toMatchObject({ x: 52 });
		expect(constrainToGround(at(50, 0), at(52, 0), ramp, 24, 0)).toMatchObject({ x: 52 });
		const flying = at(50, 0, { airborne: true, z: 60 });
		expect(constrainToGround(flying, at(52, 0), ramp, 24, 40)).toMatchObject({ x: 52 });
	});

	it("leaves the map's steps to maxStep", () => {
		const out = sweepToGround(at(20, 0), at(44, 0), steps, 24, 4, 30);
		expect(out.x).toBe(44);
	});

	it("slides down ground steeper than the limit", () => {
		const motion = { ...DEFAULT_MOTION, maxSlope: 40 };
		const out = slideOnSteep(at(50, 0, { z: 50 }), ramp, ramp, motion, 0.1);
		expect(out.x).toBeCloseTo(50 - motion.moveSpeed * SLIDE_SPEED * 0.1, 6);
		expect(slideOnSteep(at(50, 0), gentle, gentle, motion, 0.1).x).toBe(50);
		const flying = at(50, 0, { airborne: true });
		expect(slideOnSteep(flying, ramp, ramp, motion, 0.1)).toBe(flying);
		expect(slideOnSteep(at(50, 0), ramp, ramp, DEFAULT_MOTION, 0.1).x).toBe(50);
	});

	it("is kept between 0 and 89 degrees", () => {
		expect(createCharacterStore({ motion: { maxSlope: 120 } }).getState().motion.maxSlope).toBe(89);
		expect(createCharacterStore({ motion: { maxSlope: -3 } }).getState().motion.maxSlope).toBe(0);
	});
});

describe("jumping off a slope", () => {
	it("leaves between straight up and the ground's normal, at the same speed", () => {
		expect(takeoffVelocity(100, { x: 0, y: 0 }, 0.5)).toEqual({ vx: 0, vy: 0, vz: 100 });
		expect(takeoffVelocity(100, { x: 1, y: 0 }, 0)).toEqual({ vx: 0, vy: 0, vz: 100 });
		const normal = takeoffVelocity(100, { x: 1, y: 0 }, 1);
		expect(normal.vx).toBeCloseTo(-100 / Math.SQRT2, 6);
		expect(normal.vz).toBeCloseTo(100 / Math.SQRT2, 6);
		const half = takeoffVelocity(100, { x: 1, y: 0 }, 0.5);
		expect(half.vx).toBeLessThan(0);
		expect(half.vx).toBeGreaterThan(normal.vx);
		expect(Math.hypot(half.vx, half.vy, half.vz)).toBeCloseTo(100, 6);
	});

	it("carries the sideways speed through the air and drops it on landing", () => {
		const jump = { ...DEFAULT_JUMP, slopeRatio: 1 };
		const input = { ...NO_INPUT, jump: true, jumpPressed: true };
		const off = stepVertical(at(50, 0, { z: 50 }), IDLE_JUMP, input, 0.01, 50, 24, jump, 0, {
			x: 1,
			y: 0,
		});
		expect(off.pose.airborne).toBe(true);
		expect(off.pose.vx).toBeLessThan(0);
		expect(off.pose.vy).toBe(0);

		const moved = pushInAir(off.pose, off.pose, 0.1);
		expect(moved.x).toBeCloseTo(50 + off.pose.vx * 0.1, 6);
		expect(pushInAir(at(0, 0), at(1, 0), 0.1).x).toBe(1);

		const landed = stepVertical(
			{ ...off.pose, z: 1, vz: -50 },
			off.timers,
			NO_INPUT,
			0.1,
			0,
			24,
			jump,
		);
		expect(landed.pose).toMatchObject({ airborne: false, vx: 0, vy: 0 });
	});
});

describe("slopeTiltTransform", () => {
	const apply = (css: string, v: [number, number, number]) => {
		const m = css.slice(9, -1).split(",").map(Number);
		return [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2]);
	};

	it("is nothing on flat ground", () => {
		expect(slopeTiltTransform(0, 0)).toBeNull();
	});

	it("lays the sprite along the slope: its right edge rises with the ground", () => {
		const css = slopeTiltTransform(1, 0) as string;
		const [x, y, z] = apply(css, [1, 0, 0]);
		expect(x).toBeCloseTo(Math.SQRT1_2, 5);
		expect(y).toBeCloseTo(0, 5);
		expect(z).toBeCloseTo(Math.SQRT1_2, 5);
		// Up turns to the normal.
		const up = apply(css, [0, 0, 1]);
		expect(up[0]).toBeCloseTo(-Math.SQRT1_2, 5);
		expect(up[2]).toBeCloseTo(Math.SQRT1_2, 5);
		// Down the screen (+y) rises with a +y gradient.
		const [, y2, z2] = apply(slopeTiltTransform(0, 0.5) as string, [0, 1, 0]);
		expect(z2 / y2).toBeCloseTo(0.5, 5);
	});
});

describe("bodyLeanFactor", () => {
	it("leans fully on the ground, whatever the altitude says", () => {
		expect(bodyLeanFactor(0, false)).toBe(1);
		expect(bodyLeanFactor(30, false)).toBe(1);
	});

	it("still leans fully at the instant of take-off", () => {
		expect(bodyLeanFactor(0, true)).toBe(1);
	});

	it("fades out over AIR_LEAN_FADE in the air, then stays level", () => {
		expect(bodyLeanFactor(AIR_LEAN_FADE / 2, true)).toBeCloseTo(0.5);
		expect(bodyLeanFactor(AIR_LEAN_FADE, true)).toBe(0);
		expect(bodyLeanFactor(200, true)).toBe(0);
	});
});
