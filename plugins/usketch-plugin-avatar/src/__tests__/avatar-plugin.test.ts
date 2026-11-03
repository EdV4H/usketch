import type { PluginContext } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAvatarPlugin } from "../plugin.js";

type State = Record<string, unknown>;

function fakeAwareness(clientID = 1) {
	const states = new Map<number, State>([[clientID, {}]]);
	const handlers = new Set<() => void>();
	const emit = () => {
		for (const h of handlers) h();
	};
	return {
		doc: { clientID },
		states,
		setCount: () => setCalls.length,
		getLocalState: () => states.get(clientID) ?? null,
		getStates: () => states,
		setLocalStateField(field: string, value: unknown) {
			setCalls.push(field);
			states.set(clientID, { ...states.get(clientID), [field]: value });
			emit();
		},
		setRemote(id: number, state: State) {
			states.set(id, state);
			emit();
		},
		on: (_: "change", h: () => void) => handlers.add(h),
		off: (_: "change", h: () => void) => handlers.delete(h),
	};
}
let setCalls: string[] = [];

function fakeCtx() {
	let viewport = { x: 0, y: 0, zoom: 1 };
	const storeListeners = new Set<() => void>();
	const layers = new Set<string>();
	const transients = new Set<string>();
	const transientEmits: { id: string; position: { x: number; y: number } }[] = [];
	const emitted: string[] = [];
	const ctx = {
		events: { emit: (name: string) => emitted.push(name) },
		store: {
			getViewport: () => viewport,
			subscribe: (l: () => void) => {
				storeListeners.add(l);
				return () => storeListeners.delete(l);
			},
		},
		layers: {
			register: (l: { id: string }) => layers.add(l.id),
			unregister: (id: string) => layers.delete(id),
		},
		transient: {
			registerType: () => {},
			emit: (o: { id: string; position: { x: number; y: number } }) => {
				transientEmits.push(o);
				transients.add(o.id);
			},
			dismiss: (id: string) => transients.delete(id),
		},
	};
	return {
		ctx: ctx as unknown as PluginContext,
		layers,
		transients,
		transientEmits,
		emitted,
		pan(dx: number) {
			viewport = { ...viewport, x: viewport.x + dx };
			for (const l of storeListeners) l();
		},
	};
}

const hasCharacter = (s: State) => s.character != null;
const avatar = (userId: string) => ({ name: userId, image: null, userId });

describe("avatar plugin", () => {
	beforeEach(() => {
		setCalls = [];
		vi.useFakeTimers();
		vi.stubGlobal("window", { innerWidth: 800, innerHeight: 600 });
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	function setup() {
		const awareness = fakeAwareness();
		const f = fakeCtx();
		const plugin = createAvatarPlugin({
			wsProvider: { awareness } as unknown as WsProviderHandle,
			userId: "me",
			userName: "Me",
			hideAvatar: hasCharacter,
		});
		const dispose = plugin.setup?.(f.ctx) as (() => void) | undefined;
		return { awareness, ...f, dispose };
	}

	it("hides your own avatar while hideAvatar matches your state", () => {
		const { awareness, layers, dispose } = setup();
		expect(layers.has("avatar-self")).toBe(true);
		awareness.setLocalStateField("character", { x: 0, y: 0 });
		expect(layers.has("avatar-self")).toBe(false);
		awareness.setLocalStateField("character", null);
		expect(layers.has("avatar-self")).toBe(true);
		dispose?.();
	});

	it("tells the canvas to re-read its layers when your avatar hides or shows", () => {
		const { awareness, emitted, dispose } = setup();
		emitted.length = 0;
		awareness.setLocalStateField("character", { x: 0, y: 0 });
		expect(emitted).toContain("layers:changed");
		emitted.length = 0;
		awareness.setLocalStateField("character", null);
		expect(emitted).toContain("layers:changed");
		dispose?.();
	});

	it("hides another client's avatar while it matches", () => {
		const { awareness, transients, dispose } = setup();
		const vc = { x: 1, y: 2 };
		awareness.setRemote(2, { avatar: avatar("a"), viewportCenter: vc });
		expect(transients.has("avatar-2")).toBe(true);
		awareness.setRemote(2, { avatar: avatar("a"), viewportCenter: vc, character: { x: 1 } });
		expect(transients.has("avatar-2")).toBe(false);
		dispose?.();
	});

	it("re-emits another client's avatar only when its avatar or viewportCenter changes", () => {
		const { awareness, transients, transientEmits, dispose } = setup();
		const a = avatar("a");
		awareness.setRemote(2, { avatar: a, viewportCenter: { x: 1, y: 2 } });
		awareness.setRemote(3, { avatar: avatar("b"), viewportCenter: { x: 5, y: 5 } });
		transientEmits.length = 0;
		// Cursor moves (yours or theirs) change awareness but not what the avatar shows.
		awareness.setLocalStateField("cursor", { x: 10, y: 10 });
		awareness.setRemote(2, { avatar: a, viewportCenter: { x: 1, y: 2 }, cursor: { x: 3, y: 4 } });
		expect(transientEmits).toEqual([]);
		// Their viewport moved: only that avatar is emitted again, at the new spot.
		awareness.setRemote(2, { avatar: a, viewportCenter: { x: 7, y: 8 } });
		expect(transientEmits.map((o) => [o.id, o.position])).toEqual([["avatar-2", { x: 7, y: 8 }]]);
		// Hidden and shown again: it comes back even though nothing else changed.
		awareness.setRemote(2, { avatar: a, viewportCenter: { x: 7, y: 8 }, character: { x: 1 } });
		expect(transients.has("avatar-2")).toBe(false);
		transientEmits.length = 0;
		awareness.setRemote(2, { avatar: a, viewportCenter: { x: 7, y: 8 } });
		expect(transients.has("avatar-2")).toBe(true);
		expect(transientEmits.map((o) => o.id)).toEqual(["avatar-2"]);
		dispose?.();
	});

	it("throttles viewportCenter updates while the viewport moves every frame", () => {
		const { pan, awareness, dispose } = setup();
		const before = setCalls.filter((f) => f === "viewportCenter").length;
		// 60 frames ≈ 1 s of a camera following a character.
		for (let i = 0; i < 60; i++) {
			pan(1);
			vi.advanceTimersByTime(16);
		}
		vi.advanceTimersByTime(100);
		const sent = setCalls.filter((f) => f === "viewportCenter").length - before;
		expect(sent).toBeLessThanOrEqual(22);
		expect(sent).toBeGreaterThan(10);
		// The last position is always delivered.
		expect(awareness.getLocalState()?.viewportCenter).toEqual({ x: 400 - 60, y: 300 });
		dispose?.();
	});
});
