import type { PluginAction, PluginContext } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createFollowMePlugin } from "../plugin.js";

type State = Record<string, unknown>;

function fakeAwareness(selfId: number) {
	const states = new Map<number, State>();
	const listeners = new Set<() => void>();
	return {
		states,
		awareness: {
			doc: { clientID: selfId },
			getStates: () => states,
			on: (_: string, fn: () => void) => listeners.add(fn),
			off: (_: string, fn: () => void) => listeners.delete(fn),
		},
		emit: () => {
			for (const fn of listeners) fn();
		},
	};
}

function harness() {
	const aw = fakeAwareness(1);
	aw.states.set(1, { user: { name: "Me" } });
	aw.states.set(2, { user: { name: "Alice" }, cursor: { x: 0, y: 0 } });
	aw.states.set(3, { user: { name: "Bob" } });

	const actions = new Map<string, PluginAction>();
	let changes = 0;
	const registry = {
		register(action: PluginAction) {
			changes++;
			actions.set(action.id, action);
			return () => {
				if (actions.get(action.id) === action) {
					actions.delete(action.id);
					changes++;
				}
			};
		},
	};
	const eventHandlers = new Map<string, (data: unknown) => void>();
	const ctx = {
		store: {},
		actions: registry,
		layers: { register: () => {}, unregister: () => {} },
		events: {
			on: (name: string, fn: (data: unknown) => void) => {
				eventHandlers.set(name, fn);
				return () => eventHandlers.delete(name);
			},
		},
		shortcuts: { register: () => () => {} },
	} as unknown as PluginContext;
	const plugin = createFollowMePlugin({ wsProvider: { awareness: aw.awareness } as never });
	const cleanup = plugin.setup(ctx) as () => void;
	return { aw, actions, changes: () => changes, eventHandlers, cleanup };
}

describe("follow-me Control HUD actions", () => {
	it("registers unfollow + one action per remote member", () => {
		const h = harness();
		expect([...h.actions.keys()].sort()).toEqual([
			"follow:member:2",
			"follow:member:3",
			"follow:unfollow",
		]);
		expect(h.actions.get("follow:member:2")?.label).toBe("👤 Alice");
	});

	it("does not re-register actions when only a cursor / viewport moves", () => {
		const h = harness();
		const before = h.changes();
		for (let i = 0; i < 10; i++) {
			h.aw.states.set(2, { user: { name: "Alice" }, cursor: { x: i, y: i } });
			h.aw.emit();
		}
		expect(h.changes()).toBe(before);
	});

	it("rebuilds when a member joins, leaves, renames or starts presenting", () => {
		const h = harness();

		h.aw.states.set(4, { user: { name: "Carol" } });
		h.aw.emit();
		expect(h.actions.get("follow:member:4")?.label).toBe("👤 Carol");

		h.aw.states.set(3, { user: { name: "Bobby" } });
		h.aw.emit();
		expect(h.actions.get("follow:member:3")?.label).toBe("👤 Bobby");

		h.aw.states.set(2, { user: { name: "Alice" }, presenting: true });
		h.aw.emit();
		expect(h.actions.get("follow:member:2")?.label).toBe("📺 Alice");

		// A missing name ("Unknown") and an empty name ("") label differently, so they must rebuild.
		h.aw.states.set(3, { user: {} });
		h.aw.emit();
		expect(h.actions.get("follow:member:3")?.label).toBe("👤 Unknown");
		h.aw.states.set(3, { user: { name: "" } });
		h.aw.emit();
		expect(h.actions.get("follow:member:3")?.label).toBe("👤 ");

		h.aw.states.delete(4);
		h.aw.emit();
		expect(h.actions.has("follow:member:4")).toBe(false);
	});

	it("updates the unfollow label and active state when follow starts / stops", () => {
		const h = harness();
		h.eventHandlers.get("follow:start")?.({ clientId: 3, name: "Bob" });
		expect(h.actions.get("follow:unfollow")?.label).toBe("⏹ Unfollow Bob");
		expect(h.actions.get("follow:member:3")?.isActive?.()).toBe(true);
		expect(h.actions.get("follow:unfollow")?.isEnabled?.()).toBe(true);

		// Switching to a member with the same display name still re-registers
		// (so the HUD is notified of the new active row).
		const before = h.changes();
		h.aw.states.set(4, { user: { name: "Bob" } });
		h.aw.emit();
		const afterJoin = h.changes();
		expect(afterJoin).toBeGreaterThan(before);
		h.eventHandlers.get("follow:start")?.({ clientId: 4, name: "Bob" });
		expect(h.changes()).toBeGreaterThan(afterJoin);
		expect(h.actions.get("follow:member:4")?.isActive?.()).toBe(true);

		h.eventHandlers.get("follow:stop")?.(undefined);
		expect(h.actions.get("follow:unfollow")?.label).toBe("⏹ Unfollow");
		expect(h.actions.get("follow:unfollow")?.isEnabled?.()).toBe(false);
	});

	it("unregisters everything on cleanup", () => {
		const h = harness();
		h.cleanup();
		expect(h.actions.size).toBe(0);
	});
});
