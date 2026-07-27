import { describe, expect, it, vi } from "vitest";
import { createReactiveStore } from "../reactive-store.js";

describe("createReactiveStore", () => {
	it("applies partial patches", () => {
		const s = createReactiveStore({ a: 1, b: 2 });
		s.set({ a: 5 });
		expect(s.get()).toEqual({ a: 5, b: 2 });
	});

	it("ignores undefined keys (does not clobber existing values)", () => {
		const s = createReactiveStore<{ a: number; b: string }>({ a: 1, b: "x" });
		s.set({ a: undefined, b: "y" });
		expect(s.get()).toEqual({ a: 1, b: "y" }); // a preserved
	});

	it("does not notify when nothing changes", () => {
		const s = createReactiveStore({ a: 1 });
		const listener = vi.fn();
		s.subscribe(listener);
		s.set({ a: 1 });
		s.set({ a: undefined });
		expect(listener).not.toHaveBeenCalled();
	});

	it("notifies subscribers on change and unsubscribes", () => {
		const s = createReactiveStore({ a: 1 });
		const listener = vi.fn();
		const unsub = s.subscribe(listener);
		s.set({ a: 2 });
		expect(listener).toHaveBeenCalledTimes(1);
		unsub();
		s.set({ a: 3 });
		expect(listener).toHaveBeenCalledTimes(1);
	});
});
