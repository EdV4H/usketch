import { describe, expect, it, vi } from "vitest";
import {
	CROUPIER_AWARENESS_FIELD,
	createAwarenessPresence,
	type PresenceAwareness,
} from "../awareness-presence.js";

function fakeAwareness(clientId: number) {
	const states = new Map<number, Record<string, unknown>>([[clientId, {}]]);
	const listeners = new Set<() => void>();
	const emit = () => {
		for (const l of listeners) l();
	};
	const awareness: PresenceAwareness = {
		setLocalStateField(field, value) {
			states.set(clientId, { ...states.get(clientId), [field]: value });
			emit();
		},
		getStates: () => states,
		on: (_e, l) => listeners.add(l),
		off: (_e, l) => listeners.delete(l),
	};
	const setRemote = (id: number, state: Record<string, unknown> | undefined) => {
		if (state) states.set(id, state);
		else states.delete(id);
		emit();
	};
	return { awareness, states, setRemote, listeners };
}

describe("createAwarenessPresence", () => {
	it("publishes the local user and tracks who is connected", () => {
		const { awareness, states, setRemote } = fakeAwareness(1);
		const presence = createAwarenessPresence(awareness, "alice");
		expect(states.get(1)?.[CROUPIER_AWARENESS_FIELD]).toEqual({ userId: "alice" });
		expect(presence.isOnline("alice")).toBe(true);
		expect(presence.isOnline("bob")).toBe(false);

		setRemote(2, { [CROUPIER_AWARENESS_FIELD]: { userId: "bob" } });
		expect(presence.isOnline("bob")).toBe(true);
		setRemote(2, undefined);
		expect(presence.isOnline("bob")).toBe(false);
	});

	it("notifies only when the set of online users changes", () => {
		const { awareness, setRemote } = fakeAwareness(1);
		const presence = createAwarenessPresence(awareness, "alice");
		const listener = vi.fn();
		presence.subscribe(listener);

		setRemote(2, { [CROUPIER_AWARENESS_FIELD]: { userId: "bob" }, cursor: { x: 1 } });
		expect(listener).toHaveBeenCalledTimes(1);
		setRemote(2, { [CROUPIER_AWARENESS_FIELD]: { userId: "bob" }, cursor: { x: 2 } });
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("clears its field and stops listening on dispose", () => {
		const { awareness, states, listeners } = fakeAwareness(1);
		const presence = createAwarenessPresence(awareness, "alice");
		presence.dispose();
		expect(states.get(1)?.[CROUPIER_AWARENESS_FIELD]).toBeNull();
		expect(listeners.size).toBe(0);
	});
});
