import { describe, expect, it } from "vitest";
import { type CharacterPose, constrainToGround, type HeightAt } from "../character-physics.js";

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
