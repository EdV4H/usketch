import type { SelectionForeground } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createSelectionForegroundRegistry } from "../selection-foreground-registry.js";

function entry(id: string, priority: number): SelectionForeground {
	return { id, priority, render: () => null };
}

describe("createSelectionForegroundRegistry", () => {
	it("returns null when nothing is registered", () => {
		const r = createSelectionForegroundRegistry();
		expect(r.getActive()).toBeNull();
	});

	it("higher priority wins", () => {
		const r = createSelectionForegroundRegistry();
		r.register(entry("a", 0));
		r.register(entry("b", 50));
		expect(r.getActive()?.id).toBe("b");
	});

	it("on tie, last registered wins", () => {
		const r = createSelectionForegroundRegistry();
		r.register(entry("a", 10));
		r.register(entry("b", 10));
		expect(r.getActive()?.id).toBe("b");
	});

	it("re-registering same id bumps it to last (wins on tie)", () => {
		const r = createSelectionForegroundRegistry();
		r.register(entry("a", 10));
		r.register(entry("b", 10));
		expect(r.getActive()?.id).toBe("b");
		r.register(entry("a", 10));
		expect(r.getActive()?.id).toBe("a");
	});

	it("unregister falls back to next-best", () => {
		const r = createSelectionForegroundRegistry();
		r.register(entry("a", 0));
		r.register(entry("b", 100));
		expect(r.getActive()?.id).toBe("b");
		r.unregister("b");
		expect(r.getActive()?.id).toBe("a");
	});

	it("unsubscribe returned by register removes the entry", () => {
		const r = createSelectionForegroundRegistry();
		const off = r.register(entry("a", 0));
		expect(r.getActive()?.id).toBe("a");
		off();
		expect(r.getActive()).toBeNull();
	});

	it("subscribe notifies when active actually changes", () => {
		const r = createSelectionForegroundRegistry();
		const listener = vi.fn();
		r.subscribe(listener);

		r.register(entry("a", 0));
		expect(listener).toHaveBeenCalledTimes(1);

		// Lower-priority entry does not change the active — no notification.
		r.register({ id: "b", priority: -5, render: () => null });
		expect(listener).toHaveBeenCalledTimes(1);

		// Higher-priority entry takes over — one notification.
		r.register(entry("c", 100));
		expect(listener).toHaveBeenCalledTimes(2);
	});
});
