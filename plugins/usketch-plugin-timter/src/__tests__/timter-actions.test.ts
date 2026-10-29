import type { PluginAction, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTimterPlugin } from "../plugin.js";
import { makeTimerShape } from "../timer-shape.js";

function harness() {
	const store = createBoardStore();
	const actions = new Map<string, PluginAction>();
	let registrations = 0;
	const registry = {
		register(action: PluginAction) {
			registrations++;
			actions.set(action.id, action);
			return () => {
				if (actions.get(action.id) === action) actions.delete(action.id);
			};
		},
	};
	let serverNow = 0;
	const ctx = {
		store,
		actions: registry,
		shapes: { register: () => () => {} },
		tools: { register: () => () => {} },
		commands: { execute: (c: { execute(): void }) => c.execute() },
	} as unknown as PluginContext;
	const plugin = createTimterPlugin({ serverClock: { now: () => serverNow } as never });
	return {
		store,
		actions,
		registrations: () => registrations,
		setNow: (ms: number) => {
			serverNow = ms;
		},
		setup: () => plugin.setup(ctx) as () => void,
	};
}

function timer(id: string, serverNow = 0): ShapeData {
	return makeTimerShape({
		id,
		x: 0,
		y: 0,
		timerType: "countdown",
		durationMs: 5 * 60_000,
		serverNow,
	}) as ShapeData;
}

function rect(id: string): ShapeData {
	return {
		id,
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	} as ShapeData;
}

describe("timter per-timer Controls actions", () => {
	beforeEach(() => {
		vi.stubGlobal("window", { addEventListener() {}, removeEventListener() {} });
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("does not re-register on viewport, selection or unrelated shape changes", () => {
		const h = harness();
		h.store.addShape(timer("t1"));
		h.store.addShape(rect("r1"));
		const dispose = h.setup();
		const before = h.registrations();
		expect(h.actions.get("timter:t1:toggle")?.label).toBe("⏸ ⏳ #1 5:00");

		for (let i = 0; i < 10; i++) h.store.setViewport({ x: -i, y: 0, zoom: 1 });
		h.store.setSelection(["r1"]);
		for (let i = 0; i < 10; i++) h.store.updateShape("r1", { x: i });

		expect(h.registrations()).toBe(before);
		dispose();
	});

	it("re-registers when a timer's label changes or a timer is added", () => {
		const h = harness();
		h.store.addShape(timer("t1"));
		const dispose = h.setup();

		h.store.updateShape("t1", {
			running: false,
			anchorAt: null,
			accumMs: 5 * 60_000,
		} as Partial<ShapeData>);
		expect(h.actions.get("timter:t1:toggle")?.label).toBe("▶ ⏳ #1 5:00");

		h.store.addShape(timer("t2"));
		expect(h.actions.get("timter:t2:toggle")?.label).toBe("⏸ ⏳ #2 5:00");
		expect(h.actions.get("timter:t2:remove")?.label).toBe("✕ #2 削除");

		h.store.deleteShape("t1");
		expect(h.actions.has("timter:t1:toggle")).toBe(false);
		expect(h.actions.get("timter:t2:toggle")?.label).toBe("⏸ ⏳ #1 5:00");
		dispose();
	});

	it("ticks the running timer's label every second", () => {
		const h = harness();
		h.store.addShape(timer("t1"));
		const dispose = h.setup();

		h.setNow(1_000);
		vi.advanceTimersByTime(1_000);
		expect(h.actions.get("timter:t1:toggle")?.label).toBe("⏸ ⏳ #1 4:59");

		// A store change within the same displayed second keeps the registration.
		const before = h.registrations();
		h.store.updateShape("t1", { x: 10 });
		expect(h.registrations()).toBe(before);
		dispose();
	});
});
