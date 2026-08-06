import { describe, expect, it } from "vitest";
import { sumOthers } from "../hand-panel.js";
import type { CardHandAwareness } from "../hand-store.js";

function fakeAwareness(
	selfClientId: number,
	states: [number, Record<string, unknown>][],
): CardHandAwareness {
	return {
		setLocalStateField() {},
		getStates: () => new Map(states),
		on() {},
		off() {},
		doc: { clientID: selfClientId },
	};
}

describe("sumOthers", () => {
	it("returns 0 without awareness", () => {
		expect(sumOthers(undefined, "me")).toBe(0);
	});

	it("sums other clients' counts, excluding self client", () => {
		const aw = fakeAwareness(1, [
			[1, { cardHand: { userId: "me", count: 3 } }], // self client → excluded
			[2, { cardHand: { userId: "u2", count: 2 } }],
			[3, { cardHand: { userId: "u3", count: 4 } }],
		]);
		expect(sumOthers(aw, "me")).toBe(6);
	});

	it("does not double-count the same user on another client", () => {
		const aw = fakeAwareness(1, [
			[2, { cardHand: { userId: "me", count: 5 } }], // same user, different client → excluded
			[3, { cardHand: { userId: "u3", count: 4 } }],
		]);
		expect(sumOthers(aw, "me")).toBe(4);
	});

	it("ignores states without a numeric count", () => {
		const aw = fakeAwareness(1, [
			[2, {}],
			[3, { cardHand: { userId: "u3" } }],
			[4, { cardHand: { userId: "u4", count: 1 } }],
		]);
		expect(sumOthers(aw, "me")).toBe(1);
	});
});
