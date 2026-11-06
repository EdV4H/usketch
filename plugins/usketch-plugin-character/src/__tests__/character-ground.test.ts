import { describe, expect, it } from "vitest";
import {
	blockingHeight,
	type CharacterPose,
	constrainToGround,
	type HeightAt,
	standingHeight,
	sweepToGround,
} from "../character-physics.js";

const pose = (x: number, y: number, extra: Partial<CharacterPose> = {}): CharacterPose => ({
	x,
	y,
	heading: 90,
	speed: 400,
	moving: true,
	...extra,
});

// A 100-high plateau covering x >= 10, and a 20-high ledge covering y >= 10.
const heightAt: HeightAt = (x, y) => (x >= 10 ? 100 : y >= 10 ? 20 : 0);

describe("constrainToGround", () => {
	it("allows moves onto ground within the step", () => {
		const next = pose(5, 12);
		expect(constrainToGround(pose(5, 5), next, heightAt, 24)).toBe(next);
	});

	it("blocks climbing a cliff taller than the step", () => {
		const out = constrainToGround(pose(5, 5), pose(12, 5), heightAt, 24);
		expect(out).toMatchObject({ x: 5, y: 5, speed: 0, moving: false, heading: 90 });
	});

	it("slides along the cliff when only one axis is blocked", () => {
		// Diagonal into the plateau: keep the y part (onto the 20 ledge is climbable).
		const out = constrainToGround(pose(5, 5), pose(12, 12), heightAt, 24);
		expect(out).toMatchObject({ x: 5, y: 12, moving: true });
	});

	it("always allows stepping down", () => {
		const next = pose(5, 5);
		expect(constrainToGround(pose(12, 5), next, heightAt, 0)).toBe(next);
	});

	it("measures the step from the feet while in the air", () => {
		// Feet 90 high mid-jump: the 100 plateau is within a 24 step of them.
		const next = pose(12, 5);
		expect(constrainToGround(pose(5, 5, { z: 90, airborne: true }), next, heightAt, 24)).toBe(next);
		// Not high enough yet: blocked, as on the ground.
		expect(
			constrainToGround(pose(5, 5, { z: 60, airborne: true }), pose(12, 5), heightAt, 24),
		).toMatchObject({ x: 5, y: 5 });
	});

	it("measures the step from where the character stands", () => {
		// Already on the plateau: walking across it is flat.
		const next = pose(50, 5);
		expect(constrainToGround(pose(12, 5), next, heightAt, 0)).toBe(next);
	});
});

describe("solids on the ground", () => {
	it("blocks a move into a wall and slides along it", () => {
		// A wall covering x >= 10 on flat ground.
		const blockAt: HeightAt = (x) => blockingHeight(0, x >= 10 ? Number.POSITIVE_INFINITY : null);
		const out = constrainToGround(pose(5, 5), pose(12, 8), blockAt, 24);
		expect(out).toMatchObject({ x: 5, y: 8 });
	});
	it("lets a jump land on a platform top but never on a wall", () => {
		expect(blockingHeight(10, 40)).toBe(40);
		expect(blockingHeight(10, 5)).toBe(10); // buried in the terrain
		expect(blockingHeight(10, null)).toBe(10);
		expect(blockingHeight(10, Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
		expect(standingHeight(10, 40)).toBe(40);
		expect(standingHeight(10, Number.POSITIVE_INFINITY)).toBe(10);
		expect(standingHeight(10, Number.NaN)).toBe(10);
		expect(standingHeight(10, null)).toBe(10);
	});
	it("steps onto a low platform and is stopped by a tall one", () => {
		const low: HeightAt = (x) => blockingHeight(0, x >= 10 ? 16 : null);
		expect(constrainToGround(pose(5, 5), pose(12, 5), low, 24)).toMatchObject({ x: 12 });
		const tall: HeightAt = (x) => blockingHeight(0, x >= 10 ? 64 : null);
		expect(constrainToGround(pose(5, 5), pose(12, 5), tall, 24)).toMatchObject({ x: 5 });
		// From the air, high enough, it clears.
		expect(constrainToGround(pose(5, 5, { z: 50 }), pose(12, 5), tall, 24)).toMatchObject({
			x: 12,
		});
	});
});

describe("sweepToGround", () => {
	// A wall 5 units thick at 10 <= x < 15 (thicker than a stretch): one 20-unit step skips it.
	const thin: HeightAt = (x) =>
		blockingHeight(0, x >= 10 && x < 15 ? Number.POSITIVE_INFINITY : null);
	it("does not jump over a wall thinner than the move", () => {
		expect(constrainToGround(pose(0, 0), pose(20, 0), thin, 24)).toMatchObject({ x: 20 });
		const out = sweepToGround(pose(0, 0), pose(20, 0), thin, 24);
		expect(out.x).toBeLessThan(10);
		expect(out).toMatchObject({ speed: 0, moving: false });
	});
	it("slides along a wall over the whole move", () => {
		const out = sweepToGround(pose(0, 0), pose(20, 20), thin, 24);
		expect(out.x).toBeLessThan(10);
		expect(out.y).toBeCloseTo(20);
	});
	it("matches a plain move when nothing is in the way", () => {
		const flat: HeightAt = () => 0;
		expect(sweepToGround(pose(0, 0), pose(20, 5), flat, 24)).toMatchObject({ x: 20, y: 5 });
		expect(sweepToGround(pose(0, 0), pose(1, 1), flat, 24)).toMatchObject({ x: 1, y: 1 });
	});
});
