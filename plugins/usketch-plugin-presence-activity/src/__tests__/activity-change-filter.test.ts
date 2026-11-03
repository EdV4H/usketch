import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { describe, expect, it } from "vitest";
import { createActivityChangeFilter } from "../activity-overlay.js";

type Awareness = WsProviderHandle["awareness"];

const SELF = 1;

/** Fake awareness whose local client is `SELF`; `states` is mutated by the tests. */
function fakeAwareness(states: Map<number, Record<string, unknown>>): Awareness {
	return { doc: { clientID: SELF }, getStates: () => states } as unknown as Awareness;
}

const change = (c: { added?: number[]; updated?: number[]; removed?: number[] }) => ({
	added: c.added ?? [],
	updated: c.updated ?? [],
	removed: c.removed ?? [],
});

describe("createActivityChangeFilter", () => {
	it("ignores the local client's own updates (e.g. its cursor)", () => {
		const states = new Map([[SELF, { user: { name: "me" }, cursor: { x: 0, y: 0 } }]]);
		const changed = createActivityChangeFilter(fakeAwareness(states));
		expect(changed(change({ updated: [SELF] }))).toBe(false);
		states.set(SELF, {
			user: { name: "me" },
			cursor: { x: 5, y: 5 },
			activity: { shapeIds: ["a"] },
		});
		expect(changed(change({ updated: [SELF] }))).toBe(false);
	});

	it("reports a remote participant's first update, then skips cursor-only updates", () => {
		const bob = { user: { name: "Bob", color: "#f00" }, activity: { shapeIds: ["a"] } };
		const states = new Map<number, Record<string, unknown>>([
			[2, { ...bob, cursor: { x: 0, y: 0 } }],
		]);
		const changed = createActivityChangeFilter(fakeAwareness(states));
		expect(changed(change({ added: [2] }))).toBe(true);
		for (let i = 1; i <= 3; i++) {
			// A fresh object each time, like a decoded awareness update.
			states.set(2, structuredClone({ ...bob, cursor: { x: i, y: i } }));
			expect(changed(change({ updated: [2] }))).toBe(false);
		}
	});

	it("reports changes to activity, user name and user color", () => {
		const states = new Map<number, Record<string, unknown>>([
			[2, { user: { name: "Bob", color: "#f00" }, activity: { shapeIds: ["a"] } }],
		]);
		const changed = createActivityChangeFilter(fakeAwareness(states));
		changed(change({ added: [2] }));

		states.set(2, { user: { name: "Bob", color: "#f00" }, activity: { shapeIds: ["a", "b"] } });
		expect(changed(change({ updated: [2] }))).toBe(true);
		states.set(2, { user: { name: "Bobby", color: "#f00" }, activity: { shapeIds: ["a", "b"] } });
		expect(changed(change({ updated: [2] }))).toBe(true);
		states.set(2, { user: { name: "Bobby", color: "#0f0" }, activity: { shapeIds: ["a", "b"] } });
		expect(changed(change({ updated: [2] }))).toBe(true);
		states.set(2, { user: { name: "Bobby", color: "#0f0" } });
		expect(changed(change({ updated: [2] }))).toBe(true);
	});

	it("reports a remote participant leaving, even one it never saw update", () => {
		const states = new Map<number, Record<string, unknown>>([
			[2, { activity: { shapeIds: ["a"] } }],
		]);
		const changed = createActivityChangeFilter(fakeAwareness(states));
		states.delete(2);
		expect(changed(change({ removed: [2] }))).toBe(true);
		expect(changed(change({ removed: [SELF] }))).toBe(false);
	});

	it("reports a participant that comes back after leaving", () => {
		const bob = { activity: { shapeIds: ["a"] } };
		const states = new Map<number, Record<string, unknown>>([[2, bob]]);
		const changed = createActivityChangeFilter(fakeAwareness(states));
		changed(change({ added: [2] }));
		states.delete(2);
		changed(change({ removed: [2] }));
		states.set(2, structuredClone(bob));
		expect(changed(change({ added: [2] }))).toBe(true);
	});
});
