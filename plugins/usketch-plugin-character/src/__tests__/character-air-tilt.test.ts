import { describe, expect, it } from "vitest";
import { residualTilt } from "../character-layer.js";
import {
	type AirTiltParams,
	type Attitude,
	attitudeError,
	type CharacterPose,
	DEFAULT_AIR_TILT,
	groundAttitude,
	IDLE_TILT_LATCH,
	LEVEL,
	type MoveInput,
	NO_INPUT,
	ORIGIN_POSE,
	stepAirTilt,
	type TiltLatch,
} from "../character-physics.js";
import { createCharacterStore, effectiveAirTilt, sanitizeAirTilt } from "../character-store.js";
import { easeRemotes, parseWireState } from "../character-sync.js";
import type { RemoteCharacter } from "../character-types.js";

const DT = 1 / 60;
const flat = () => LEVEL;
const key = (k: Partial<MoveInput>): MoveInput => ({ ...NO_INPUT, ...k });
const ground: CharacterPose = { ...ORIGIN_POSE, speed: 300, moveVy: -300 };
const air: CharacterPose = { ...ground, airborne: true, z: 30 };
const ARMED: TiltLatch = { pitch: true, roll: true };

/** Run `steps` airborne frames from `pose` with `input` held (axes armed). */
function fly(pose: CharacterPose, input: MoveInput, steps: number, tilt = DEFAULT_AIR_TILT) {
	let p = pose;
	let latch = ARMED;
	for (let i = 0; i < steps; i++) {
		const out = stepAirTilt(p, p, latch, input, DT, tilt, flat);
		p = out.pose;
		latch = out.latch;
	}
	return p;
}

describe("groundAttitude", () => {
	it("is level on flat ground", () => {
		expect(groundAttitude({ x: 0, y: 0 }, 37)).toEqual({ pitch: 0, roll: 0 });
	});
	it("pitches nose up on ground rising ahead, down on ground falling ahead", () => {
		// Heading 0 faces -y: ground rising toward -y has a negative y gradient.
		expect(groundAttitude({ x: 0, y: -1 }, 0).pitch).toBeCloseTo(45);
		expect(groundAttitude({ x: 0, y: -1 }, 180).pitch).toBeCloseTo(-45);
		expect(groundAttitude({ x: 0, y: -1 }, 0).roll).toBeCloseTo(0);
	});
	it("rolls left on ground rising to the right", () => {
		// Heading 0: the right is +x.
		const a = groundAttitude({ x: 1, y: 0 }, 0);
		expect(a.roll).toBeCloseTo(-45);
		expect(a.pitch).toBeCloseTo(0);
		// Facing +x (90°), ground rising along +x is ahead: nose up instead.
		expect(groundAttitude({ x: 1, y: 0 }, 90).pitch).toBeCloseTo(45);
	});
});

describe("attitudeError", () => {
	it("measures the angle between the bodies' up directions", () => {
		expect(attitudeError(LEVEL, LEVEL)).toBeCloseTo(0);
		expect(attitudeError({ pitch: 30, roll: 0 }, LEVEL)).toBeCloseTo(30);
		expect(attitudeError({ pitch: 0, roll: -40 }, LEVEL)).toBeCloseTo(40);
		expect(attitudeError({ pitch: 180, roll: 0 }, LEVEL)).toBeCloseTo(180);
		// A full turn is back upright.
		expect(attitudeError({ pitch: 360, roll: -360 }, LEVEL)).toBeCloseTo(0);
	});
});

describe("stepAirTilt", () => {
	it("keeps the body level with air tilt off", () => {
		const tilted = { ...air, pitch: 20, roll: 5 };
		const out = stepAirTilt(tilted, tilted, ARMED, key({ up: true }), DT, null, flat);
		expect(out.pose).toMatchObject({ pitch: 0, roll: 0 });
		expect(out.latch).toBe(IDLE_TILT_LATCH);
	});

	it("pitches with the throttle keys and rolls with the steering keys in the air", () => {
		const t = DEFAULT_AIR_TILT;
		expect(fly(air, key({ up: true }), 6).pitch).toBeCloseTo(-t.pitchRate * 6 * DT);
		expect(fly(air, key({ down: true }), 6).pitch).toBeCloseTo(t.pitchRate * 6 * DT);
		expect(fly(air, key({ right: true }), 6).roll).toBeCloseTo(t.rollRate * 6 * DT);
		expect(fly(air, key({ left: true }), 6).roll).toBeCloseTo(-t.rollRate * 6 * DT);
	});

	it("turns all the way round while held (a flip)", () => {
		const t = DEFAULT_AIR_TILT;
		const steps = Math.round(360 / (t.pitchRate * DT));
		const flipped = fly(air, key({ down: true }), steps);
		expect(attitudeError(flipped, LEVEL)).toBeLessThan(1);
	});

	it("ignores keys held at take-off until they are released", () => {
		const takeoff = { ...air };
		const held = key({ up: true, right: true });
		let out = stepAirTilt(ground, takeoff, IDLE_TILT_LATCH, held, DT, DEFAULT_AIR_TILT, flat);
		expect(out.pose).toMatchObject({ pitch: 0, roll: 0 });
		out = stepAirTilt(out.pose, out.pose, out.latch, held, DT, DEFAULT_AIR_TILT, flat);
		expect(out.pose).toMatchObject({ pitch: 0, roll: 0 });
		// Let go of the throttle only: pitch arms, roll still waits.
		out = stepAirTilt(
			out.pose,
			out.pose,
			out.latch,
			key({ right: true }),
			DT,
			DEFAULT_AIR_TILT,
			flat,
		);
		expect(out.latch).toEqual({ pitch: true, roll: false });
		out = stepAirTilt(out.pose, out.pose, out.latch, held, DT, DEFAULT_AIR_TILT, flat);
		expect(out.pose.pitch).toBeLessThan(0);
		expect(out.pose.roll).toBe(0);
	});

	it("takes off with the lean it had on the ground", () => {
		const onRamp = { ...ground, pitch: 25 };
		const out = stepAirTilt(
			onRamp,
			{ ...onRamp, airborne: true },
			IDLE_TILT_LATCH,
			NO_INPUT,
			DT,
			DEFAULT_AIR_TILT,
			flat,
		);
		expect(out.pose.pitch).toBe(25);
	});

	it("lands clean within the tolerance and keeps its speed", () => {
		const slightly = { ...air, pitch: 20 };
		const out = stepAirTilt(
			slightly,
			{ ...slightly, airborne: false, z: 0 },
			ARMED,
			NO_INPUT,
			DT,
			DEFAULT_AIR_TILT,
			flat,
		);
		expect(out.pose.speed).toBe(300);
		expect(out.latch).toBe(IDLE_TILT_LATCH);
	});

	it("loses speed landing too far off the ground's lean", () => {
		const nose = { ...air, pitch: -70, drift: 1 as const };
		const out = stepAirTilt(
			nose,
			{ ...nose, airborne: false, z: 0 },
			ARMED,
			NO_INPUT,
			DT,
			DEFAULT_AIR_TILT,
			flat,
		);
		expect(out.pose.speed).toBeCloseTo(300 * DEFAULT_AIR_TILT.badLandingSpeed);
		expect(out.pose.moveVy).toBeCloseTo(-300 * DEFAULT_AIR_TILT.badLandingSpeed);
		expect(out.pose.drift).toBe(0);
	});

	it("judges the landing against the ground where it touches down", () => {
		// Nose up 40° onto a 45° upslope ahead: within the tolerance.
		const upslope = (): Attitude => ({ pitch: 45, roll: 0 });
		const nose = { ...air, pitch: 40 };
		const out = stepAirTilt(
			nose,
			{ ...nose, airborne: false },
			ARMED,
			NO_INPUT,
			DT,
			DEFAULT_AIR_TILT,
			upslope,
		);
		expect(out.pose.speed).toBe(300);
		// Level onto the same slope: 45° off.
		const level = { ...air };
		const bad = stepAirTilt(
			level,
			{ ...level, airborne: false },
			ARMED,
			NO_INPUT,
			DT,
			DEFAULT_AIR_TILT,
			upslope,
		);
		expect(bad.pose.speed).toBeCloseTo(150);
	});

	it("lands a full flip clean", () => {
		const t = DEFAULT_AIR_TILT;
		const flipped = fly(air, key({ up: true }), Math.round(360 / (t.pitchRate * DT)));
		const out = stepAirTilt(flipped, { ...flipped, airborne: false }, ARMED, NO_INPUT, DT, t, flat);
		expect(out.pose.speed).toBe(300);
	});

	it("settles onto the ground's lean on the ground", () => {
		const tilt: AirTiltParams = { ...DEFAULT_AIR_TILT, settleRate: 10 };
		let p: CharacterPose = { ...ground, pitch: 30, roll: -170 };
		for (let i = 0; i < 120; i++) {
			p = stepAirTilt(p, p, IDLE_TILT_LATCH, NO_INPUT, DT, tilt, flat).pose;
		}
		expect(p.pitch).toBe(0);
		expect(p.roll).toBe(0);
		// The short way round: 350° (stored as -10°) settles back up through -5°, not down
		// through 180°.
		const near = { ...ground, roll: -10 };
		const once = stepAirTilt(near, near, IDLE_TILT_LATCH, NO_INPUT, DT, tilt, flat);
		expect(once.pose.roll).toBeGreaterThan(-10);
		expect(once.pose.roll).toBeLessThan(0);
	});

	it("doesn't penalize a bad landing with badLandingSpeed 1", () => {
		const tilt = { ...DEFAULT_AIR_TILT, badLandingSpeed: 1 };
		const nose = { ...air, pitch: -90 };
		const out = stepAirTilt(nose, { ...nose, airborne: false }, ARMED, NO_INPUT, DT, tilt, flat);
		expect(out.pose.speed).toBe(300);
	});
});

describe("air tilt settings", () => {
	it("sanitizes the tuning", () => {
		expect(sanitizeAirTilt(undefined)).toBeNull();
		expect(sanitizeAirTilt(true)).toBe(DEFAULT_AIR_TILT);
		expect(
			sanitizeAirTilt({ pitchRate: -5, landingTolerance: 400, badLandingSpeed: 2, settleRate: 0 }),
		).toEqual({
			...DEFAULT_AIR_TILT,
			pitchRate: DEFAULT_AIR_TILT.pitchRate,
			landingTolerance: 180,
			badLandingSpeed: 1,
		});
	});
	it("only tilts the vehicle scheme and keeps the tuning across off / on", () => {
		const store = createCharacterStore({ airTilt: { landingTolerance: 50 } });
		expect(effectiveAirTilt(store.getState())).toBeNull();
		store.setControlScheme("vehicle");
		expect(effectiveAirTilt(store.getState())?.landingTolerance).toBe(50);
		store.setAirTilt(false);
		expect(effectiveAirTilt(store.getState())).toBeNull();
		store.setAirTilt(true);
		expect(store.getState().airTilt?.landingTolerance).toBe(50);
	});
});

describe("air tilt for the renderer", () => {
	it("leaves only what the spot's ground lean doesn't carry", () => {
		expect(residualTilt(null, { pitch: 30, roll: 0 }, 1)).toEqual(LEVEL);
		// Settled on the ground: the spot's lean carries it all.
		expect(residualTilt({ pitch: 30, roll: -10 }, { pitch: 30, roll: -10 }, 1)).toEqual({
			pitch: 0,
			roll: 0,
		});
		// High in the air the spot is level: the whole attitude.
		expect(residualTilt({ pitch: 120, roll: 0 }, { pitch: 30, roll: 0 }, 0)).toEqual({
			pitch: 120,
			roll: 0,
		});
	});
});

describe("air tilt over awareness", () => {
	it("parses the attitude (wrapped) and drops junk", () => {
		expect(
			parseWireState({ x: 0, y: 0, heading: 0, attitude: { pitch: 370, roll: -20 } })?.attitude,
		).toEqual({
			pitch: 10,
			roll: -20,
		});
		expect(
			parseWireState({ x: 0, y: 0, heading: 0, attitude: { pitch: "x", roll: 0 } })?.attitude,
		).toBeNull();
		expect(parseWireState({ x: 0, y: 0, heading: 0 })?.attitude).toBeNull();
	});
	it("eases the attitude the short way round", () => {
		const r = (attitude: Attitude | null): RemoteCharacter => ({
			id: "a",
			x: 0,
			y: 0,
			heading: 0,
			speed: 0,
			moving: false,
			controlScheme: "vehicle",
			steering: 0,
			slip: 0,
			drifting: false,
			z: null,
			airborne: true,
			vz: 0,
			hovering: false,
			hoverGauge: null,
			attitude,
			appearance: {},
		});
		const { next, settling } = easeRemotes(
			new Map([["a", r({ pitch: 170, roll: 0 })]]),
			new Map([["a", r({ pitch: -170, roll: 10 })]]),
			0.5,
		);
		expect(settling).toBe(true);
		expect(next.get("a")?.attitude).toEqual({ pitch: 180, roll: 5 });
	});
});
