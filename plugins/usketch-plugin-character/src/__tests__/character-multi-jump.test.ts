import { describe, expect, it } from "vitest";
import { keyChoiceOf, withKeyChoice } from "../character-key-choices.js";
import {
	airJumpSpeed,
	type CharacterPose,
	DEFAULT_DRIFT,
	DEFAULT_HOVER,
	DEFAULT_JUMP,
	drainHoverGauge,
	hoverSpeed,
	IDLE_JUMP,
	type JumpParams,
	type JumpTimers,
	jumpArc,
	type MoveInput,
	NO_INPUT,
	ORIGIN_POSE,
	rechargeHoverGauge,
	stepVertical,
} from "../character-physics.js";
import {
	createCharacterStore,
	driftHopHeight,
	effectiveJump,
	hoverGaugeOf,
	sanitizeDrift,
	sanitizeHover,
	sanitizeJump,
} from "../character-store.js";
import { createCharacterSync, parseWireState } from "../character-sync.js";
import { DEFAULT_KEYS } from "../character-types.js";

const DT = 1 / 120;
const MAX_STEP = 24;
const held = (p: Partial<MoveInput>): MoveInput => ({ ...NO_INPUT, ...p });

/** Steps `stepVertical` on flat ground (height 0) with a per-step input. */
function run(
	jump: JumpParams,
	inputs: (step: number, pose: CharacterPose) => MoveInput,
	steps: number,
) {
	let pose = ORIGIN_POSE;
	let timers: JumpTimers = IDLE_JUMP;
	const trace: { pose: CharacterPose; timers: JumpTimers }[] = [];
	for (let i = 0; i < steps; i++) {
		const out = stepVertical(pose, timers, inputs(i, pose), DT, 0, MAX_STEP, jump);
		pose = out.pose;
		timers = out.timers;
		trace.push(out);
	}
	return { pose, timers, trace };
}

/** Press on step 0 and at `again` (both edges), holding nothing in between. */
const pressesAt =
	(...at: number[]) =>
	(i: number) =>
		held({ jump: at.includes(i), jumpPressed: at.includes(i) });

const DOUBLE: JumpParams = { ...DEFAULT_JUMP, airJumps: 1 };

describe("air jumps", () => {
	it("a press in the air uses an air jump with √ratio of the take-off speed", () => {
		const { trace } = run(DOUBLE, pressesAt(0, 20), 21);
		const speed = jumpArc(DOUBLE).speed;
		expect(trace[20].timers.airJumpsUsed).toBe(1);
		// The step integrates gravity after setting the speed.
		const g = jumpArc(DOUBLE).gravity;
		expect(trace[20].pose.vz).toBeCloseTo(airJumpSpeed(speed, 0.8) - g * DT, 6);
		expect(airJumpSpeed(speed, 0.8)).toBeCloseTo(speed * Math.sqrt(0.8));
	});
	it("only as many as `airJumps`; more presses do nothing in the air", () => {
		const { trace } = run(DOUBLE, pressesAt(0, 20, 30), 31);
		expect(trace[30].timers.airJumpsUsed).toBe(1);
		expect(trace[30].pose.vz).toBeLessThan(trace[29].pose.vz); // just gravity
	});
	it("none with the default single jump", () => {
		const { trace } = run(DEFAULT_JUMP, pressesAt(0, 20), 21);
		expect(trace[20].timers.airJumpsUsed).toBe(0);
		expect(trace[20].pose.vz).toBeLessThan(trace[19].pose.vz);
	});
	it("come back on landing", () => {
		// Jump, air-jump, land, jump again, air-jump again.
		const first = run(DOUBLE, pressesAt(0, 20), 400);
		expect(first.pose.airborne).toBe(false);
		expect(first.timers.airJumpsUsed).toBe(0);
		let pose = first.pose;
		let timers = first.timers;
		for (let i = 0; i < 21; i++) {
			const press = i === 0 || i === 20;
			({ pose, timers } = stepVertical(
				pose,
				timers,
				held({ jump: press, jumpPressed: press }),
				DT,
				0,
				MAX_STEP,
				DOUBLE,
			));
		}
		expect(timers.airJumpsUsed).toBe(1);
	});
	it("an air jump at the apex reaches about ratio × height higher", () => {
		const jump: JumpParams = { ...DOUBLE, airJumpRatio: 0.5 };
		const apexStep = Math.round(jump.timeToApex / DT);
		// Held throughout (a release while rising would cut the jumps short).
		const { trace } = run(
			jump,
			(i) => held({ jump: true, jumpPressed: i === 0 || i === apexStep }),
			400,
		);
		const zAtPress = trace[apexStep - 1].pose.z;
		const top = Math.max(...trace.slice(apexStep).map((s) => s.pose.z));
		// Within the fixed-step integration's error of the exact ratio × height.
		expect(Math.abs(top - zAtPress - jump.height * 0.5)).toBeLessThan(jump.height * 0.5 * 0.05);
	});
});

const HOVER: JumpParams = { ...DEFAULT_JUMP, hover: DEFAULT_HOVER };
const holdAll = (i: number) => held({ jump: true, jumpPressed: i === 0 });

describe("hover", () => {
	it("holding the key past the apex hovers at -fallSpeed and drains the gauge", () => {
		const apexStep = Math.ceil(HOVER.timeToApex / DT) + 2;
		const { trace } = run(HOVER, holdAll, apexStep + 60);
		const s = trace[apexStep + 59];
		expect(s.pose.hovering).toBe(true);
		expect(s.pose.vz).toBe(-DEFAULT_HOVER.fallSpeed);
		expect(s.pose.hoverGauge).toBeLessThan(1);
		expect(s.pose.hoverGauge).toBeGreaterThan(0);
	});
	it("an empty gauge falls normally", () => {
		const jump: JumpParams = { ...HOVER, hover: { ...DEFAULT_HOVER, duration: 0.2 } };
		const { trace } = run(jump, holdAll, 120);
		const hovered = trace.findIndex((s) => s.pose.hovering);
		expect(hovered).toBeGreaterThan(0);
		const after = trace.slice(hovered).find((s) => !s.pose.hovering && s.pose.airborne);
		expect(after?.pose.hoverGauge).toBe(0);
		expect(after?.pose.vz).toBeLessThan(-DEFAULT_HOVER.fallSpeed);
	});
	it("a fallSpeed of 0 holds the altitude", () => {
		const jump: JumpParams = { ...HOVER, hover: { ...DEFAULT_HOVER, fallSpeed: 0 } };
		const apexStep = Math.ceil(jump.timeToApex / DT) + 2;
		const { trace } = run(jump, holdAll, apexStep + 30);
		expect(trace[apexStep + 29].pose.z).toBeCloseTo(trace[apexStep + 10].pose.z, 9);
	});
	it("a thrust above gravity climbs while the key is held, up to riseSpeed", () => {
		const jump: JumpParams = { ...HOVER, hover: { ...DEFAULT_HOVER, thrust: 1.5, duration: 5 } };
		const apexStep = Math.ceil(jump.timeToApex / DT) + 2;
		const { trace } = run(jump, holdAll, apexStep + 240);
		const start = trace.findIndex((s) => s.pose.hovering);
		const later = trace[apexStep + 239].pose;
		expect(later.hovering).toBe(true);
		expect(later.vz).toBe(DEFAULT_HOVER.riseSpeed);
		expect(later.z).toBeGreaterThan(trace[start].pose.z);
		// Releasing the key stops the thrust: it falls back down.
		let pose = later;
		let timers = trace[apexStep + 239].timers;
		for (let i = 0; i < 60; i++) {
			({ pose, timers } = stepVertical(pose, timers, NO_INPUT, DT, 0, MAX_STEP, jump));
		}
		expect(pose.hovering).toBe(false);
		expect(pose.vz).toBeLessThan(0);
	});
	it("hoverSpeed: thrust − 1 times gravity, between −fallSpeed and riseSpeed", () => {
		const h = { ...DEFAULT_HOVER, fallSpeed: 15, riseSpeed: 60 };
		expect(hoverSpeed(-5, 0.1, 100, { ...h, thrust: 1 })).toBe(-5); // balanced
		expect(hoverSpeed(0, 0.1, 100, { ...h, thrust: 1.5 })).toBeCloseTo(5);
		expect(hoverSpeed(0, 0.1, 100, { ...h, thrust: 0.5 })).toBeCloseTo(-5);
		expect(hoverSpeed(-200, 0.1, 100, { ...h, thrust: 0 })).toBe(-15); // a fast fall is caught
		expect(hoverSpeed(58, 0.1, 100, { ...h, thrust: 3 })).toBe(60);
		expect(hoverSpeed(0, 0.1, 100, { ...h, thrust: Number.NaN })).toBe(-10);
	});
	it("not while rising, and not without the key", () => {
		const { trace } = run(HOVER, pressesAt(0), 200);
		expect(trace.some((s) => s.pose.hovering)).toBe(false);
		const rising = run(HOVER, holdAll, 10).trace;
		expect(rising.some((s) => s.pose.hovering)).toBe(false);
	});
	it("only after the air jumps are used up", () => {
		const jump: JumpParams = { ...HOVER, airJumps: 1 };
		const apexStep = Math.ceil(jump.timeToApex / DT) + 2;
		// Held through the apex with an air jump left: no hover.
		const before = run(jump, holdAll, apexStep + 20).trace;
		expect(before.some((s) => s.pose.hovering)).toBe(false);
		// Use the air jump (a fresh press), keep holding: hovers after its apex.
		const after = run(
			jump,
			(i) => held({ jump: true, jumpPressed: i === 0 || i === apexStep }),
			apexStep * 3,
		).trace;
		expect(after.some((s) => s.pose.hovering)).toBe(true);
	});
	it("the gauge refills on the ground over rechargeTime, not at once on landing", () => {
		const jump: JumpParams = { ...HOVER, hover: { ...DEFAULT_HOVER, duration: 0.3 } };
		// Hover until empty, fall, land, then stand there.
		const { trace } = run(jump, holdAll, 600);
		const landed = trace.findIndex(
			(s, i) => i > 0 && trace[i - 1].pose.airborne && !s.pose.airborne,
		);
		expect(landed).toBeGreaterThan(0);
		// One ground step's worth of refill at touchdown, not a full gauge.
		expect(trace[landed].pose.hoverGauge).toBeLessThan(0.1);
		const half = landed + Math.round(DEFAULT_HOVER.rechargeTime / 2 / DT);
		expect(trace[half].pose.hoverGauge).toBeGreaterThan(0.4);
		expect(trace[half].pose.hoverGauge).toBeLessThan(0.6);
		expect(trace.at(-1)?.pose.hoverGauge).toBe(1);
	});
	it("with hovering off the gauge stays full", () => {
		const { trace } = run(DEFAULT_JUMP, holdAll, 200);
		expect(trace.every((s) => s.pose.hoverGauge === 1 && !s.pose.hovering)).toBe(true);
	});
	it("gauge helpers", () => {
		expect(drainHoverGauge(1, 0.75, DEFAULT_HOVER)).toBeCloseTo(0.5);
		expect(drainHoverGauge(0.1, 1, DEFAULT_HOVER)).toBe(0);
		expect(rechargeHoverGauge(0, 0.4, DEFAULT_HOVER)).toBeCloseTo(0.5);
		expect(rechargeHoverGauge(0.9, 1, DEFAULT_HOVER)).toBe(1);
		expect(rechargeHoverGauge(0, 0.1, { ...DEFAULT_HOVER, rechargeTime: 0 })).toBe(1);
	});
});

describe("vehicle", () => {
	it("gets air jumps and hover too (the jump has its own key)", () => {
		const store = createCharacterStore({ jump: { airJumps: 1, hover: true } });
		store.setControlScheme("vehicle");
		expect(effectiveJump(store.getState())?.airJumps).toBe(1);
		expect(hoverGaugeOf(store.getState())).toBe(1);
	});
});

describe("drift hop", () => {
	const hopIn = (hop: number, input: MoveInput, pose = ORIGIN_POSE) =>
		stepVertical(pose, IDLE_JUMP, input, DT, 0, MAX_STEP, null, hop);
	it("a drift press on the ground hops hopHeight high", () => {
		let { pose, timers } = hopIn(10, held({ drift: true, driftPressed: true }));
		expect(pose.airborne).toBe(true);
		let top = 0;
		for (let i = 0; i < 120 && pose.airborne; i++) {
			({ pose, timers } = stepVertical(pose, timers, held({ drift: true }), DT, 0, MAX_STEP, null));
			top = Math.max(top, pose.z);
		}
		expect(top).toBeGreaterThan(9);
		expect(top).toBeLessThan(10.5);
		expect(pose.airborne).toBe(false);
	});
	it("not without the hop, nor from a held key, nor in the air", () => {
		expect(hopIn(0, held({ drift: true, driftPressed: true })).pose.airborne).toBe(false);
		expect(hopIn(10, held({ drift: true })).pose.airborne).toBe(false);
		const flying = { ...ORIGIN_POSE, z: 30, vz: -5, airborne: true };
		expect(hopIn(10, held({ drift: true, driftPressed: true }), flying).pose.vz).toBeLessThan(-5);
	});
	it("only a vehicle with drift + hop on hops", () => {
		const store = createCharacterStore({ drift: { hop: true, hopHeight: 12 } });
		expect(driftHopHeight(store.getState())).toBe(0);
		store.setControlScheme("vehicle");
		expect(driftHopHeight(store.getState())).toBe(12);
		store.setDrift({ hop: false });
		expect(driftHopHeight(store.getState())).toBe(0);
		expect(sanitizeDrift({ hopHeight: -4 })?.hopHeight).toBe(0);
		expect(sanitizeDrift({ hopHeight: Number.NaN })?.hopHeight).toBe(DEFAULT_DRIFT.hopHeight);
	});
});

describe("tuning", () => {
	it("sanitizes air jumps, ratio and hover", () => {
		const j = sanitizeJump({ airJumps: 2.7, airJumpRatio: 0.5, hover: { duration: 2 } });
		expect(j?.airJumps).toBe(2);
		expect(j?.airJumpRatio).toBe(0.5);
		expect(j?.hover).toEqual({ ...DEFAULT_HOVER, duration: 2 });
		expect(sanitizeJump({ hover: true })?.hover).toEqual(DEFAULT_HOVER);
		expect(sanitizeJump({ hover: false })?.hover).toBeNull();
		expect(sanitizeJump(true)?.hover).toBeNull();
	});
	it("rejects nonsense hover values", () => {
		expect(
			sanitizeHover(
				{ duration: 0, fallSpeed: -3, rechargeTime: Number.NaN, thrust: -1, riseSpeed: Infinity },
				null,
			),
		).toEqual(DEFAULT_HOVER);
		expect(sanitizeHover({ thrust: 1.2 }, null)?.thrust).toBe(1.2);
		expect(sanitizeHover(undefined, DEFAULT_HOVER)).toBe(DEFAULT_HOVER);
	});
	it("keeps the hover tuning across hover off → on", () => {
		const store = createCharacterStore({ jump: { hover: { duration: 3 } } });
		store.setJump({ hover: false });
		expect(store.getState().jump?.hover).toBeNull();
		store.setJump({ hover: true });
		expect(store.getState().jump?.hover?.duration).toBe(3);
	});
});

describe("sync", () => {
	it("reads the hover fields (missing → false / null, gauge clamped)", () => {
		expect(parseWireState({ x: 0, y: 0, heading: 0 })).toMatchObject({
			hovering: false,
			hoverGauge: null,
		});
		expect(
			parseWireState({ x: 0, y: 0, heading: 0, hovering: true, hoverGauge: 1.7 }),
		).toMatchObject({ hovering: true, hoverGauge: 1 });
		expect(parseWireState({ x: 0, y: 0, heading: 0, hoverGauge: "full" })).toMatchObject({
			hoverGauge: null,
		});
	});
	it("publishes the gauge only while hovering is on", () => {
		const sent: unknown[] = [];
		const awareness = {
			clientID: 1,
			setLocalStateField: (_f: string, v: unknown) => sent.push(v),
			getStates: () => new Map(),
			on: () => {},
			off: () => {},
		};
		const store = createCharacterStore({ enabled: true, jump: true });
		const sync = createCharacterSync(awareness, store, () => {});
		sync.publish(true);
		expect(sent.at(-1)).toMatchObject({ hovering: false, hoverGauge: null });
		store.setJump({ hover: true });
		store.setPose({ ...store.getState().pose, hovering: true, hoverGauge: 0.42 });
		sync.publish(true);
		expect(sent.at(-1)).toMatchObject({ hovering: true, hoverGauge: 0.4 });
		sync.dispose();
	});
});

describe("key choices", () => {
	it("maps HUD choices to codes and back", () => {
		expect(keyChoiceOf(DEFAULT_KEYS.drift)?.value).toBe("shift");
		expect(keyChoiceOf(DEFAULT_KEYS.jump)?.value).toBe("space");
		expect(keyChoiceOf(["ShiftRight", "ShiftLeft"])?.value).toBe("shift");
		expect(keyChoiceOf(["KeyQ"])).toBeNull();
		expect(withKeyChoice(DEFAULT_KEYS, "jump", "z").jump).toEqual(["KeyZ"]);
		expect(withKeyChoice(DEFAULT_KEYS, "drift", "nope")).toBe(DEFAULT_KEYS);
	});
});
