import { describe, expect, it } from "vitest";
import { DEFAULT_DRIFT } from "../character-physics.js";
import { createCharacterStore, sanitizeDrift } from "../character-store.js";

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
