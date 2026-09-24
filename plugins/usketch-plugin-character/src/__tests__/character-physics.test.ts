import { describe, expect, it } from "vitest";
import {
	type CharacterPose,
	DEFAULT_MOTION,
	headingVector,
	type MoveInput,
	NO_INPUT,
	stepCharacter,
	turnToward,
	vectorHeading,
} from "../character-physics.js";

const origin: CharacterPose = { x: 0, y: 0, heading: 0, speed: 0, moving: false };
const held = (p: Partial<MoveInput>): MoveInput => ({ ...NO_INPUT, ...p });

describe("heading helpers", () => {
	it("0° points up (-y), 90° points right (+x)", () => {
		const up = headingVector(0);
		expect(up.x).toBeCloseTo(0, 12);
		expect(up.y).toBeCloseTo(-1, 12);
		const right = headingVector(90);
		expect(right.x).toBeCloseTo(1, 12);
		expect(right.y).toBeCloseTo(0, 12);
	});
	it("vectorHeading inverts headingVector", () => {
		for (const h of [0, 45, 90, 135, 180, -135, -90, -45]) {
			const v = headingVector(h);
			expect(vectorHeading(v.x, v.y)).toBeCloseTo(h === -180 ? 180 : h, 9);
		}
	});
	it("turnToward caps the step and goes the short way", () => {
		expect(turnToward(170, -170, 5)).toBe(175);
		expect(turnToward(0, 30, 90)).toBe(30);
		expect(turnToward(10, -10, 5)).toBe(5);
	});
});

describe("directional scheme", () => {
	it("moves up by moveSpeed·dt and keeps facing up", () => {
		const p = stepCharacter(origin, held({ up: true }), 0.5, "directional", DEFAULT_MOTION);
		expect(p.x).toBeCloseTo(0, 9);
		expect(p.y).toBeCloseTo(-DEFAULT_MOTION.moveSpeed * 0.5, 9);
		expect(p.heading).toBe(0);
		expect(p.moving).toBe(true);
	});
	it("normalizes diagonals (no √2 speed-up)", () => {
		const p = stepCharacter(
			origin,
			held({ up: true, right: true }),
			1,
			"directional",
			DEFAULT_MOTION,
		);
		expect(Math.hypot(p.x, p.y)).toBeCloseTo(DEFAULT_MOTION.moveSpeed, 9);
	});
	it("turns toward the movement at turnRate instead of snapping", () => {
		const p = stepCharacter(origin, held({ right: true }), 0.1, "directional", DEFAULT_MOTION);
		expect(p.heading).toBeCloseTo(DEFAULT_MOTION.turnRate * 0.1, 9);
	});
	it("maps screen directions through the camera rotation", () => {
		// Camera turned so the world is rotated -90° (character facing world right = screen up):
		// pressing "up" must move along world +x.
		const p = stepCharacter(origin, held({ up: true }), 1, "directional", DEFAULT_MOTION, -90);
		expect(p.x).toBeCloseTo(DEFAULT_MOTION.moveSpeed, 9);
		expect(p.y).toBeCloseTo(0, 9);
	});
	it("returns the same pose object when idle", () => {
		expect(stepCharacter(origin, NO_INPUT, 0.1, "directional", DEFAULT_MOTION)).toBe(origin);
	});
});

describe("vehicle scheme", () => {
	it("accelerates toward top speed along the heading", () => {
		let p = origin;
		for (let i = 0; i < 100; i++)
			p = stepCharacter(p, held({ up: true }), 0.05, "vehicle", DEFAULT_MOTION);
		expect(p.speed).toBe(DEFAULT_MOTION.moveSpeed);
		expect(p.y).toBeLessThan(0);
		expect(p.x).toBeCloseTo(0, 6);
	});
	it("can't turn while stopped", () => {
		const p = stepCharacter(origin, held({ right: true }), 0.1, "vehicle", DEFAULT_MOTION);
		expect(p.heading).toBe(0);
	});
	it("steers right when moving forward and inverts when reversing", () => {
		const fwd = stepCharacter(
			{ ...origin, speed: DEFAULT_MOTION.moveSpeed },
			held({ up: true, right: true }),
			0.1,
			"vehicle",
			DEFAULT_MOTION,
		);
		expect(fwd.heading).toBeGreaterThan(0);
		const rev = stepCharacter(
			{ ...origin, speed: -DEFAULT_MOTION.moveSpeed * 0.5 },
			held({ down: true, right: true }),
			0.1,
			"vehicle",
			DEFAULT_MOTION,
		);
		expect(rev.heading).toBeLessThan(0);
	});
	it("coasts to a stop with friction", () => {
		let p: CharacterPose = { ...origin, speed: 100, moving: true };
		for (let i = 0; i < 50; i++) p = stepCharacter(p, NO_INPUT, 0.05, "vehicle", DEFAULT_MOTION);
		expect(p.speed).toBe(0);
		expect(p.moving).toBe(false);
	});
	it("caps reverse speed by reverseRatio", () => {
		let p = origin;
		for (let i = 0; i < 100; i++)
			p = stepCharacter(p, held({ down: true }), 0.05, "vehicle", DEFAULT_MOTION);
		expect(p.speed).toBe(-DEFAULT_MOTION.moveSpeed * DEFAULT_MOTION.reverseRatio);
	});
});
