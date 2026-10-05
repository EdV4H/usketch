import { describe, expect, it } from "vitest";
import { createCharacterStore } from "../character-store.js";
import {
	AWARENESS_FIELD,
	type CharacterAwareness,
	createCharacterSync,
	easeRemotes,
	parseWireState,
} from "../character-sync.js";
import type { RemoteCharacter } from "../character-types.js";

function fakeAwareness(clientID = 1) {
	const states = new Map<number, Record<string, unknown>>();
	const handlers = new Set<() => void>();
	const aw: CharacterAwareness & {
		states: typeof states;
		emit(): void;
	} = {
		clientID,
		states,
		setLocalStateField(field, value) {
			states.set(clientID, { ...(states.get(clientID) ?? {}), [field]: value });
			for (const h of handlers) h();
		},
		getStates: () => states,
		on: (_e, h) => handlers.add(h),
		off: (_e, h) => handlers.delete(h),
		emit() {
			for (const h of handlers) h();
		},
	};
	return aw;
}

describe("parseWireState", () => {
	it("rejects junk and missing coordinates", () => {
		expect(parseWireState(null)).toBeNull();
		expect(parseWireState("x")).toBeNull();
		expect(parseWireState({ x: 1, y: 2 })).toBeNull();
		expect(parseWireState({ x: Number.NaN, y: 2, heading: 0 })).toBeNull();
	});
	it("normalizes a valid payload", () => {
		expect(parseWireState({ x: 1, y: 2, heading: 270, appearance: [1], name: 5 })).toEqual({
			x: 1,
			y: 2,
			heading: -90,
			speed: 0,
			moving: false,
			appearance: {},
			name: undefined,
		});
	});
});

describe("createCharacterSync", () => {
	it("publishes the local character (throttled, skipping unchanged payloads)", () => {
		const aw = fakeAwareness(1);
		const store = createCharacterStore({ enabled: true, appearance: { color: "red" }, name: "me" });
		let t = 0;
		const sync = createCharacterSync(
			aw,
			store,
			() => {},
			() => t,
		);
		sync.publish();
		expect(aw.states.get(1)?.[AWARENESS_FIELD]).toMatchObject({ x: 0, y: 0, name: "me" });

		store.setPosition({ x: 10, y: 0 });
		t = 10; // inside the throttle window
		sync.publish();
		expect(aw.states.get(1)?.[AWARENESS_FIELD]).toMatchObject({ x: 0 });
		t = 100;
		sync.publish();
		expect(aw.states.get(1)?.[AWARENESS_FIELD]).toMatchObject({ x: 10 });
	});

	it("publishes null while disabled and withdraws on dispose", () => {
		const aw = fakeAwareness(1);
		const store = createCharacterStore({ enabled: true });
		const sync = createCharacterSync(aw, store, () => {});
		sync.publish(true);
		store.setEnabled(false);
		sync.publish(true);
		expect(aw.states.get(1)?.[AWARENESS_FIELD]).toBeNull();
		store.setEnabled(true);
		sync.publish(true);
		sync.dispose();
		expect(aw.states.get(1)?.[AWARENESS_FIELD]).toBeNull();
	});

	it("reads other clients, ignoring itself and invalid payloads", () => {
		const aw = fakeAwareness(1);
		const store = createCharacterStore();
		let changes = 0;
		const sync = createCharacterSync(aw, store, () => changes++);
		aw.states.set(1, { [AWARENESS_FIELD]: { x: 9, y: 9, heading: 0 } });
		aw.states.set(2, { [AWARENESS_FIELD]: { x: 5, y: 6, heading: 90, name: "you" } });
		aw.states.set(3, { [AWARENESS_FIELD]: { nope: true } });
		aw.states.set(4, { other: 1 });
		aw.emit();
		expect([...sync.targets().keys()]).toEqual(["2"]);
		expect(sync.targets().get("2")).toMatchObject({ x: 5, y: 6, heading: 90, name: "you" });
		expect(changes).toBeGreaterThan(0);
	});
});

describe("easeRemotes", () => {
	const r = (id: string, x: number, heading = 0): RemoteCharacter => ({
		id,
		x,
		y: 0,
		heading,
		speed: 0,
		moving: false,
		appearance: {},
	});
	it("shows newcomers at once, eases known ones, drops the departed", () => {
		const display = new Map([
			["a", r("a", 0, 170)],
			["gone", r("gone", 0)],
		]);
		const targets = new Map([
			["a", r("a", 10, -170)],
			["new", r("new", 50)],
		]);
		const { next, settling } = easeRemotes(display, targets, 0.5);
		expect(settling).toBe(true);
		expect(next.get("new")?.x).toBe(50);
		expect(next.get("a")?.x).toBe(5);
		expect(next.get("a")?.heading).toBe(180);
		expect(next.has("gone")).toBe(false);
	});
	it("settles once within tolerance", () => {
		const t = new Map([["a", r("a", 10)]]);
		const { next, settling } = easeRemotes(new Map([["a", r("a", 10.01)]]), t, 0.5);
		expect(settling).toBe(false);
		expect(next.get("a")).toBe(t.get("a"));
	});
});
