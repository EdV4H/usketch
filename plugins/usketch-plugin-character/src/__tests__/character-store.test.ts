import { describe, expect, it } from "vitest";
import { DEFAULT_DRIFT, DEFAULT_JUMP } from "../character-physics.js";
import { createCharacterStore, sanitizeDrift, sanitizeJump } from "../character-store.js";

describe("drift tuning", () => {
	it("is off by default and on with defaults for `true`", () => {
		expect(createCharacterStore().getState().drift).toBeNull();
		expect(createCharacterStore({ drift: true }).getState().drift).toEqual(DEFAULT_DRIFT);
	});
	it("caps steerRate at turnRate and stopSpeed at startSpeed", () => {
		const d = sanitizeDrift({ turnRate: 0.5, steerRate: 1, startSpeed: 0.2, stopSpeed: 0.4 });
		expect(d?.steerRate).toBe(0.5);
		expect(d?.stopSpeed).toBe(0.2);
	});
	it("keeps custom tuning across off → on", () => {
		const store = createCharacterStore({ drift: { slipAngle: 40 } });
		store.setDrift(false);
		expect(store.getState().drift).toBeNull();
		store.setDrift(true);
		expect(store.getState().drift?.slipAngle).toBe(40);
	});
});

describe("jump tuning", () => {
	it("is off by default and on with defaults for `true`", () => {
		expect(createCharacterStore().getState().jump).toBeNull();
		expect(createCharacterStore({ jump: true }).getState().jump).toEqual(DEFAULT_JUMP);
	});
	it("rejects nonsense values", () => {
		const j = sanitizeJump({
			height: -5,
			timeToApex: 0,
			fallGravity: 0.2,
			releaseCut: 3,
			coyoteTime: 9,
			bufferTime: -1,
		});
		expect(j).toEqual({
			height: DEFAULT_JUMP.height,
			timeToApex: DEFAULT_JUMP.timeToApex,
			fallGravity: 1,
			releaseCut: 1,
			coyoteTime: 1,
			bufferTime: 0,
		});
	});
	it("keeps custom tuning across off → on", () => {
		const store = createCharacterStore({ jump: { height: 80 } });
		store.setJump(false);
		expect(store.getState().jump).toBeNull();
		store.setJump(true);
		expect(store.getState().jump?.height).toBe(80);
	});
	it("lands a teleport on the ground", () => {
		const store = createCharacterStore();
		store.setPose({ ...store.getState().pose, z: 90, vz: 120, airborne: true });
		store.setPosition({ x: 5, y: 5 });
		expect(store.getState().pose).toMatchObject({ x: 5, y: 5, z: 0, vz: 0, airborne: false });
	});
});
