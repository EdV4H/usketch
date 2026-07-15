import { describe, expect, it, vi } from "vitest";
import { createHandStore, type HandCardEntry } from "../hand-store.js";

function entry(id: string): HandCardEntry {
	return { id, cardType: "playing-card", fields: { rank: "A" }, width: 100, height: 150 };
}

describe("createHandStore", () => {
	it("starts empty (no localStorage in node → in-memory fallback)", () => {
		const store = createHandStore("u1");
		expect(store.getHand()).toEqual([]);
		expect(store.count()).toBe(0);
	});

	it("addToHand appends and notifies; getHand/count reflect it", () => {
		const store = createHandStore("u1");
		const listener = vi.fn();
		store.subscribe(listener);
		store.addToHand(entry("a"));
		expect(store.count()).toBe(1);
		expect(store.getHand()[0]?.id).toBe("a");
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("addToHand is idempotent per id", () => {
		const store = createHandStore("u1");
		store.addToHand(entry("a"));
		store.addToHand(entry("a"));
		expect(store.count()).toBe(1);
	});

	it("removeFromHand removes and returns the entry, notifies", () => {
		const store = createHandStore("u1");
		store.addToHand(entry("a"));
		store.addToHand(entry("b"));
		const listener = vi.fn();
		store.subscribe(listener);
		const removed = store.removeFromHand("a");
		expect(removed?.id).toBe("a");
		expect(store.getHand().map((e) => e.id)).toEqual(["b"]);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("removeFromHand of a missing id is a no-op (returns undefined, no notify)", () => {
		const store = createHandStore("u1");
		const listener = vi.fn();
		store.subscribe(listener);
		expect(store.removeFromHand("nope")).toBeUndefined();
		expect(listener).not.toHaveBeenCalled();
	});

	it("subscribe returns an unsubscribe that stops notifications", () => {
		const store = createHandStore("u1");
		const listener = vi.fn();
		const off = store.subscribe(listener);
		off();
		store.addToHand(entry("a"));
		expect(listener).not.toHaveBeenCalled();
	});
});
