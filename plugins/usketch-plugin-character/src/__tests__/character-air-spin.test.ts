import { describe, expect, it } from "vitest";
import {
	type CharacterPose,
	DEFAULT_JUMP,
	holdSteerForRoll,
	landingTilt,
	landVehicle,
	type MoveInput,
	NO_INPUT,
	ORIGIN_POSE,
	stepAirSpin,
} from "../character-physics.js";

const held = (p: Partial<MoveInput>): MoveInput => ({ ...NO_INPUT, ...p });
const flying: CharacterPose = { ...ORIGIN_POSE, airborne: true, z: 30, speed: 300, moving: true };
const FLAT = { x: 0, y: 0 };

describe("stepAirSpin", () => {
	it("pitches with the throttle keys while the drift key is held: forward = nose down", () => {
		expect(stepAirSpin(flying, held({ up: true, drift: true }), 0.1, 300).pitch).toBeCloseTo(-30);
		expect(stepAirSpin(flying, held({ down: true, drift: true }), 0.1, 300).pitch).toBeCloseTo(30);
		expect(stepAirSpin(flying, held({ up: true }), 0.1, 300)).toBe(flying); // without: no pitch
	});

	it("rolls with the steering only while the drift key is held", () => {
		expect(stepAirSpin(flying, held({ right: true }), 0.1, 300).roll).toBe(0);
		expect(stepAirSpin(flying, held({ right: true, drift: true }), 0.1, 300).roll).toBeCloseTo(30);
		expect(stepAirSpin(flying, held({ left: true, drift: true }), 0.1, 300).roll).toBeCloseTo(-30);
	});

	it("holds the attitude without keys, wraps a flip, and does nothing on the ground or when off", () => {
		const tilted = { ...flying, pitch: 170 };
		expect(stepAirSpin(tilted, NO_INPUT, 0.1, 300)).toBe(tilted);
		expect(stepAirSpin(tilted, held({ down: true, drift: true }), 0.1, 300).pitch).toBeCloseTo(
			-160,
		);
		expect(stepAirSpin(ORIGIN_POSE, held({ up: true, drift: true }), 0.1, 300)).toBe(ORIGIN_POSE);
		expect(stepAirSpin(flying, held({ up: true, drift: true }), 0.1, 0)).toBe(flying);
	});
});

describe("stepAirSpin with inertia", () => {
	const spin = (pose: CharacterPose, input: MoveInput, steps: number, dt = 0.05) => {
		let p = pose;
		for (let i = 0; i < steps; i++) p = stepAirSpin(p, input, dt, 300, 0.2);
		return p;
	};

	it("builds the spin up over spinInertia", () => {
		const first = stepAirSpin(flying, held({ down: true, drift: true }), 0.05, 300, 0.2);
		expect(first.pitchRate).toBeCloseTo(75); // a quarter of the way after 0.05 of 0.2 s
		expect(first.pitch).toBeCloseTo((75 / 2) * 0.05);
		expect(spin(flying, held({ down: true, drift: true }), 4).pitchRate).toBeCloseTo(300);
	});

	it("keeps turning after the key is released, slowing to a stop over spinInertia", () => {
		const spinning = { ...flying, pitchRate: 300, pitch: 10 };
		const coast = stepAirSpin(spinning, NO_INPUT, 0.05, 300, 0.2);
		expect(coast.pitchRate).toBeCloseTo(225);
		expect(coast.pitch).toBeGreaterThan(10);
		const stopped = spin(spinning, NO_INPUT, 4);
		expect(stopped.pitchRate).toBe(0);
		expect(stepAirSpin(stopped, NO_INPUT, 0.05, 300, 0.2)).toBe(stopped);
	});

	it("rolls on after the drift key is let go", () => {
		const rolling = { ...flying, rollRate: -300 };
		const next = stepAirSpin(rolling, held({ left: true }), 0.05, 300, 0.2);
		expect(next.rollRate).toBeCloseTo(-225);
		expect(next.roll).toBeLessThan(0);
	});

	it("is stopped by landing", () => {
		const landing = { ...flying, pitch: 10, pitchRate: 200, rollRate: -50, airborne: false };
		expect(landVehicle(flying, landing, FLAT, DEFAULT_JUMP)).toMatchObject({
			pitch: 0,
			pitchRate: 0,
			rollRate: 0,
		});
	});
});

describe("holdSteerForRoll", () => {
	it("drops the steering (no yaw) while rolling in the air", () => {
		const input = held({ right: true, drift: true, steer: 0.5 });
		const out = holdSteerForRoll(input, flying, 300);
		expect(out).toMatchObject({ right: false, left: false, steer: undefined, drift: true });
		expect(holdSteerForRoll(input, ORIGIN_POSE, 300)).toBe(input); // on the ground: a drift
		expect(holdSteerForRoll(input, flying, 0)).toBe(input); // spinning off
		const noDrift = held({ right: true });
		expect(holdSteerForRoll(noDrift, flying, 300)).toBe(noDrift);
	});
});

describe("landingTilt", () => {
	it("is the body's tilt from flat ground", () => {
		expect(landingTilt(0, 0, 0, FLAT)).toBeCloseTo(0);
		expect(landingTilt(30, 0, 0, FLAT)).toBeCloseTo(30);
		expect(landingTilt(0, -50, 90, FLAT)).toBeCloseTo(50);
		expect(landingTilt(180, 0, 0, FLAT)).toBeCloseTo(180); // on its roof
	});

	it("measures from a slope's normal, along the car's heading", () => {
		// 45° uphill toward world -y (screen up): a car facing up lines up nose-up.
		const uphill = { x: 0, y: -1 };
		expect(landingTilt(45, 0, 0, uphill)).toBeCloseTo(0);
		expect(landingTilt(0, 0, 0, uphill)).toBeCloseTo(45);
		// Facing right (heading 90) the same hill rises to its left: left side up = roll right.
		expect(landingTilt(0, 45, 90, uphill)).toBeCloseTo(0);
		expect(landingTilt(0, -45, 90, uphill)).toBeCloseTo(90);
	});
});

describe("landVehicle", () => {
	const landing = (pitch: number, roll = 0) => ({ ...flying, pitch, roll, airborne: false, z: 0 });

	it("drives on after a landing within the tolerance, levelled", () => {
		const out = landVehicle(flying, landing(20, -10), FLAT, DEFAULT_JUMP);
		expect(out).toMatchObject({ pitch: 0, roll: 0, speed: 300 });
	});

	it("keeps only crashSpeed of the speed after a landing beyond it", () => {
		const out = landVehicle(
			flying,
			{ ...landing(90), moveVx: 0, moveVy: -300 },
			FLAT,
			DEFAULT_JUMP,
		);
		expect(out.pitch).toBe(0);
		expect(out.speed).toBeCloseTo(300 * DEFAULT_JUMP.crashSpeed);
		expect(out.moveVy).toBeCloseTo(-300 * DEFAULT_JUMP.crashSpeed);
		const stop = landVehicle(flying, landing(90), FLAT, { ...DEFAULT_JUMP, crashSpeed: 0 });
		expect(stop).toMatchObject({ speed: 0, moving: false });
	});

	it("counts a full flip as a clean landing", () => {
		// 360° wraps back to ~0.
		expect(landVehicle(flying, landing(2), FLAT, DEFAULT_JUMP).speed).toBe(300);
	});

	it("doesn't judge with spinning off, and leaves the air alone", () => {
		const off = { ...DEFAULT_JUMP, spinRate: 0 };
		expect(landVehicle(flying, landing(90), FLAT, off)).toMatchObject({ pitch: 0, speed: 300 });
		const still = { ...flying, pitch: 40 };
		expect(landVehicle(flying, still, FLAT, DEFAULT_JUMP)).toBe(still);
	});
});
