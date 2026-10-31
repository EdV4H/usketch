import { describe, expect, it } from "vitest";
import {
	type CharacterPose,
	DEFAULT_JUMP,
	DEFAULT_MOTION,
	IDLE_JUMP,
	type JumpParams,
	type JumpTimers,
	jumpArc,
	type MoveInput,
	NO_INPUT,
	ORIGIN_POSE,
	stepCharacter,
	stepVertical,
} from "../character-physics.js";

const DT = 1 / 120;
const MAX_STEP = 24;
const held = (p: Partial<MoveInput>): MoveInput => ({ ...NO_INPUT, ...p });

/** Run `stepVertical` over flat-ish ground until `until` says stop (or 5 s pass). */
function simulate(
	start: CharacterPose,
	inputAt: (t: number) => MoveInput,
	ground: (t: number) => number,
	jump: JumpParams | null = DEFAULT_JUMP,
	until: (pose: CharacterPose, t: number) => boolean = (p, t) => t > 0 && !p.airborne,
) {
	let pose = start;
	let timers: JumpTimers = IDLE_JUMP;
	let t = 0;
	let apex = pose.z;
	let airtime = 0;
	while (t < 5) {
		const out = stepVertical(pose, timers, inputAt(t), DT, ground(t), MAX_STEP, jump);
		pose = out.pose;
		timers = out.timers;
		t += DT;
		apex = Math.max(apex, pose.z);
		if (pose.airborne) airtime += DT;
		if (until(pose, t)) break;
	}
	return { pose, timers, apex, airtime, t };
}

const tap = (t: number) => held({ jump: t === 0, jumpPressed: t === 0 });
const hold = (t: number) => held({ jump: true, jumpPressed: t === 0 });

describe("jumpArc", () => {
	it("derives gravity and take-off speed from apex height and time", () => {
		const { gravity, speed } = jumpArc({ ...DEFAULT_JUMP, height: 40, timeToApex: 0.4 });
		expect(gravity).toBeCloseTo(500);
		expect(speed).toBeCloseTo(200);
	});
});

describe("stepVertical", () => {
	it("stays put on flat ground without input (same objects back)", () => {
		const out = stepVertical(ORIGIN_POSE, IDLE_JUMP, NO_INPUT, DT, 0, MAX_STEP, DEFAULT_JUMP);
		expect(out.pose).toBe(ORIGIN_POSE);
		expect(out.timers).toBe(IDLE_JUMP);
	});

	it("a held jump reaches the configured height and lands", () => {
		const { pose, apex, airtime } = simulate(ORIGIN_POSE, hold, () => 0);
		expect(apex).toBeGreaterThan(DEFAULT_JUMP.height * 0.95);
		expect(apex).toBeLessThan(DEFAULT_JUMP.height * 1.05);
		// Rise takes timeToApex; the fall is faster (fallGravity > 1).
		const fall = DEFAULT_JUMP.timeToApex / Math.sqrt(DEFAULT_JUMP.fallGravity);
		expect(airtime).toBeCloseTo(DEFAULT_JUMP.timeToApex + fall, 1);
		expect(pose).toMatchObject({ z: 0, vz: 0, airborne: false });
	});

	it("releasing early cuts the jump short", () => {
		const full = simulate(ORIGIN_POSE, hold, () => 0).apex;
		const short = simulate(ORIGIN_POSE, tap, () => 0).apex;
		expect(short).toBeLessThan(full * 0.5);
		expect(short).toBeGreaterThan(0);
	});

	it("does nothing on a press while jumping is off", () => {
		const out = stepVertical(ORIGIN_POSE, IDLE_JUMP, tap(0), DT, 0, MAX_STEP, null);
		expect(out.pose.airborne).toBe(false);
	});

	it("can't jump again in the air (single jump)", () => {
		const { apex } = simulate(
			ORIGIN_POSE,
			// Press again right after the apex.
			(t) => held({ jump: true, jumpPressed: t === 0 || Math.abs(t - 0.4) < DT / 2 }),
			() => 0,
		);
		expect(apex).toBeLessThan(DEFAULT_JUMP.height * 1.05);
	});

	it("remembers a press made just before landing", () => {
		// Fall from 30 high; press ~50 ms before touching down.
		const start: CharacterPose = { ...ORIGIN_POSE, z: 30, airborne: true };
		const g = jumpArc(DEFAULT_JUMP).gravity * DEFAULT_JUMP.fallGravity;
		const touchdown = Math.sqrt((2 * 30) / g);
		const pressAt = touchdown - 0.05;
		let pressed = false;
		const { pose } = simulate(
			start,
			(t) => {
				const press = !pressed && t >= pressAt;
				if (press) pressed = true;
				return held({ jump: t >= pressAt, jumpPressed: press });
			},
			() => 0,
			DEFAULT_JUMP,
			(_p, t) => t > touchdown + 0.05,
		);
		expect(pose.airborne).toBe(true);
		expect(pose.vz).toBeGreaterThan(0);
	});

	it("a drop bigger than the step falls; a small one snaps down", () => {
		const onLedge: CharacterPose = { ...ORIGIN_POSE, z: 100 };
		const small = stepVertical(onLedge, IDLE_JUMP, NO_INPUT, DT, 90, MAX_STEP, null);
		expect(small.pose).toMatchObject({ z: 90, airborne: false });
		const big = stepVertical(onLedge, IDLE_JUMP, NO_INPUT, DT, 0, MAX_STEP, null);
		expect(big.pose.airborne).toBe(true);
		expect(big.pose.z).toBeLessThan(100);
		expect(big.pose.z).toBeGreaterThan(0);
		// …and lands on the ground below, even with jumping off.
		const { pose } = simulate(
			onLedge,
			() => NO_INPUT,
			() => 0,
			null,
		);
		expect(pose).toMatchObject({ z: 0, airborne: false });
	});

	it("still jumps just after walking off a ledge (coyote time), not later", () => {
		const onLedge: CharacterPose = { ...ORIGIN_POSE, z: 100 };
		const late = (delay: number) =>
			simulate(
				onLedge,
				(t) => held({ jump: true, jumpPressed: Math.abs(t - delay) < DT / 2 }),
				() => 0,
				DEFAULT_JUMP,
				(_p, t) => t > delay + 2 * DT,
			).pose.vz;
		expect(late(0.05)).toBeGreaterThan(0);
		expect(late(0.3)).toBeLessThan(0);
	});

	it("lands on a higher ledge reached mid-air", () => {
		// Jump from 0; the ground under the feet becomes 30 while rising.
		const { pose } = simulate(ORIGIN_POSE, hold, (t) => (t > 0.1 ? 30 : 0));
		expect(pose).toMatchObject({ z: 30, airborne: false });
	});

	it("stands on a ledge edge that is within the step above the feet", () => {
		const falling: CharacterPose = { ...ORIGIN_POSE, z: 50, vz: -100, airborne: true };
		const out = stepVertical(falling, IDLE_JUMP, NO_INPUT, DT, 60, MAX_STEP, DEFAULT_JUMP);
		expect(out.pose).toMatchObject({ z: 60, airborne: false, vz: 0 });
	});
});

describe("stepCharacter in the air", () => {
	it("a car keeps its speed and can't steer until it lands", () => {
		const flying: CharacterPose = {
			...ORIGIN_POSE,
			speed: 300,
			moving: true,
			airborne: true,
			z: 20,
		};
		const next = stepCharacter(
			flying,
			held({ down: true, left: true }),
			0.1,
			"vehicle",
			DEFAULT_MOTION,
		);
		expect(next.speed).toBe(300);
		expect(next.heading).toBe(0);
		expect(next.y).toBeCloseTo(-30);
		expect(next).toMatchObject({ z: 20, airborne: true });
	});

	it("directional movement keeps full control and the vertical state", () => {
		const flying: CharacterPose = { ...ORIGIN_POSE, airborne: true, z: 20, vz: 50 };
		const next = stepCharacter(flying, held({ right: true }), 0.1, "directional", DEFAULT_MOTION);
		expect(next.x).toBeCloseTo(DEFAULT_MOTION.moveSpeed * 0.1);
		expect(next).toMatchObject({ z: 20, vz: 50, airborne: true });
	});
});
