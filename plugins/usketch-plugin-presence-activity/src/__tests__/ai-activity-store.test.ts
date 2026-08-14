import { describe, expect, it } from "vitest";
import { createAiActivityStore } from "../ai-activity-store.js";

describe("createAiActivityStore", () => {
	it("starts empty", () => {
		expect(createAiActivityStore().get()).toBeNull();
	});

	it("set/get round-trips and notifies subscribers", () => {
		const store = createAiActivityStore();
		let calls = 0;
		const off = store.subscribe(() => {
			calls++;
		});
		store.set({ shapeIds: ["a", "b"] });
		expect(store.get()).toEqual({ shapeIds: ["a", "b"] });
		expect(calls).toBe(1);
		store.set(null);
		expect(store.get()).toBeNull();
		expect(calls).toBe(2);
		off();
	});

	it("stops notifying after unsubscribe", () => {
		const store = createAiActivityStore();
		let calls = 0;
		const off = store.subscribe(() => {
			calls++;
		});
		off();
		store.set({ shapeIds: ["x"] });
		expect(calls).toBe(0);
	});

	it("instances are independent (no shared/leaked state)", () => {
		const a = createAiActivityStore();
		const b = createAiActivityStore();
		a.set({ shapeIds: ["a"] });
		expect(b.get()).toBeNull(); // b unaffected
		b.set(null); // clearing b doesn't touch a
		expect(a.get()).toEqual({ shapeIds: ["a"] });
	});
});
