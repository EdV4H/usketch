import { describe, expect, it } from "vitest";
import { aiActivityStore } from "../ai-activity-store.js";

describe("aiActivityStore", () => {
	it("starts empty", () => {
		aiActivityStore.set(null);
		expect(aiActivityStore.get()).toBeNull();
	});

	it("set/get round-trips and notifies subscribers", () => {
		let calls = 0;
		const off = aiActivityStore.subscribe(() => {
			calls++;
		});
		aiActivityStore.set({ shapeIds: ["a", "b"] });
		expect(aiActivityStore.get()).toEqual({ shapeIds: ["a", "b"] });
		expect(calls).toBe(1);
		aiActivityStore.set(null);
		expect(aiActivityStore.get()).toBeNull();
		expect(calls).toBe(2);
		off();
	});

	it("stops notifying after unsubscribe", () => {
		let calls = 0;
		const off = aiActivityStore.subscribe(() => {
			calls++;
		});
		off();
		aiActivityStore.set({ shapeIds: ["x"] });
		expect(calls).toBe(0);
		aiActivityStore.set(null);
	});
});
