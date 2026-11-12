import { describe, expect, it } from "vitest";
import { FLAT_JUMP_MAX_SCALE, flatJumpLift } from "../character-layer.js";
import { DEFAULT_MOTION } from "../character-physics.js";
import { createCharacterStore } from "../character-store.js";

describe("flatJumpLift", () => {
	it("lifts an airborne body up the screen by altitude × zoom × flatLift on the flat board", () => {
		const { offset, scale } = flatJumpLift(40, 2, 0, 0.6);
		expect(offset).toBeCloseTo(48);
		expect(scale).toBeCloseTo(1 + 40 * 0.004);
	});

	it("does nothing on the ground", () => {
		expect(flatJumpLift(0, 1, 0, 0.6)).toEqual({ offset: 0, scale: 1 });
		expect(flatJumpLift(-5, 1, 0, 0.6)).toEqual({ offset: 0, scale: 1 });
	});

	it("fades out as the view turns 3D, and is gone in full 3D", () => {
		const half = flatJumpLift(40, 1, 0.5, 0.6);
		expect(half.offset).toBeCloseTo(12);
		expect(half.scale).toBeCloseTo(1 + 0.5 * 40 * 0.004);
		expect(flatJumpLift(40, 1, 1, 0.6)).toEqual({ offset: 0, scale: 1 });
		expect(flatJumpLift(40, 1, 3, 0.6)).toEqual({ offset: 0, scale: 1 });
	});

	it("caps the growth for a long climb", () => {
		expect(flatJumpLift(10_000, 1, 0, 0.6).scale).toBeCloseTo(1 + FLAT_JUMP_MAX_SCALE);
	});

	it("flatLift 0 leaves only the growth (and the shadow) to show the jump", () => {
		const { offset, scale } = flatJumpLift(40, 1, 0, 0);
		expect(offset).toBe(0);
		expect(scale).toBeGreaterThan(1);
	});

	it("treats non-finite input as flat / no lift", () => {
		expect(flatJumpLift(Number.NaN, 1, 0, 0.6)).toEqual({ offset: 0, scale: 1 });
		expect(flatJumpLift(40, 1, Number.NaN, Number.NaN).offset).toBe(0);
	});
});

describe("motion.flatLift", () => {
	it("defaults to 0.6", () => {
		expect(DEFAULT_MOTION.flatLift).toBe(0.6);
		expect(createCharacterStore().getState().motion.flatLift).toBe(0.6);
	});

	it("clamps to 0 … 3 and ignores junk", () => {
		const store = createCharacterStore();
		store.setMotion({ flatLift: 5 });
		expect(store.getState().motion.flatLift).toBe(3);
		store.setMotion({ flatLift: -1 });
		expect(store.getState().motion.flatLift).toBe(3);
		store.setMotion({ flatLift: 0 });
		expect(store.getState().motion.flatLift).toBe(0);
	});
});
