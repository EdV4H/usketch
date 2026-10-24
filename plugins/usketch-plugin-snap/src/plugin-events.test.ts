import type { PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSnapPlugin } from "./plugin.js";

function makeShape(overrides: Partial<ShapeData>): ShapeData {
	return {
		id: "s",
		type: "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...overrides,
	};
}

/** Just enough of PluginContext for the snap plugin: a mutable store + a sync event bus. */
function makeCtx() {
	const shapes = new Map<string, ShapeData>();
	const store = {
		getShape: (id: string) => shapes.get(id),
		getShapes: () => shapes,
		getSelection: () => new Set(["moving"]),
		getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
		addShape: (s: ShapeData) => shapes.set(s.id, s),
		updateShape: (id: string, updates: Partial<ShapeData>) => {
			const s = shapes.get(id);
			if (s) shapes.set(id, { ...s, ...updates });
		},
	};
	const listeners = new Map<string, Set<(p: unknown) => void>>();
	const events = {
		on(type: string, fn: (p: unknown) => void) {
			const bucket = listeners.get(type) ?? new Set();
			bucket.add(fn);
			listeners.set(type, bucket);
			return () => bucket.delete(fn);
		},
		emit(type: string, payload: unknown) {
			for (const fn of listeners.get(type) ?? []) fn(payload);
		},
	};
	const ctx = {
		store,
		events,
		shapes: { get: () => undefined },
		actions: { register: () => () => {} },
		layers: { register() {}, unregister() {} },
	} as unknown as PluginContext;
	return { ctx, store, events };
}

const windowListeners = new Map<string, Set<(e: unknown) => void>>();
function pressAlt(down: boolean) {
	for (const fn of windowListeners.get(down ? "keydown" : "keyup") ?? []) fn({ key: "Alt" });
}

beforeEach(() => {
	windowListeners.clear();
	vi.stubGlobal("window", {
		addEventListener(type: string, fn: (e: unknown) => void) {
			const bucket = windowListeners.get(type) ?? new Set();
			bucket.add(fn);
			windowListeners.set(type, bucket);
		},
		removeEventListener(type: string, fn: (e: unknown) => void) {
			windowListeners.get(type)?.delete(fn);
		},
	});
});
afterEach(() => vi.unstubAllGlobals());

/** Drag "moving" so its left edge lands 5px right of the anchor's right edge (x=100). */
function dragNearAnchor() {
	const { ctx, store, events } = makeCtx();
	store.addShape(makeShape({ id: "anchor", x: 0, y: 0 }));
	store.addShape(makeShape({ id: "moving", x: 300, y: 0 }));
	const teardown = createSnapPlugin().setup(ctx);
	events.emit("snap:configure", { viewportOnly: false });
	events.emit("canvas:pointerdown", { worldX: 0, worldY: 0 });
	return {
		events,
		move: () => {
			store.updateShape("moving", { x: 105, y: 0 });
			return store.getShape("moving")?.x;
		},
		teardown,
	};
}

describe("snap:alt-toggle-suppress", () => {
	it("Alt suppresses snapping by default", () => {
		const { move, teardown } = dragNearAnchor();
		pressAlt(true);
		expect(move()).toBe(105);
		if (typeof teardown === "function") teardown();
	});

	it("while suppressed, holding Alt does not toggle snapping", () => {
		const { events, move, teardown } = dragNearAnchor();
		events.emit("snap:alt-toggle-suppress", { suppressed: true });
		pressAlt(true);
		expect(move()).toBe(100);
		if (typeof teardown === "function") teardown();
	});

	it("suppressed: false restores the Alt toggle", () => {
		const { events, move, teardown } = dragNearAnchor();
		events.emit("snap:alt-toggle-suppress", { suppressed: true });
		events.emit("snap:alt-toggle-suppress", { suppressed: false });
		pressAlt(true);
		expect(move()).toBe(105);
		if (typeof teardown === "function") teardown();
	});
});

describe("snap:extra-candidates", () => {
	function dragAlone() {
		const { ctx, store, events } = makeCtx();
		store.addShape(makeShape({ id: "moving", x: 300, y: 0 }));
		const teardown = createSnapPlugin().setup(ctx);
		events.emit("snap:configure", { viewportOnly: false });
		events.emit("canvas:pointerdown", { worldX: 0, worldY: 0 });
		return {
			events,
			move: () => {
				store.updateShape("moving", { x: 105, y: 0 });
				return store.getShape("moving")?.x;
			},
			teardown,
		};
	}

	it("snaps to extra world-space boxes that are not shapes in the store", () => {
		const { events, move, teardown } = dragAlone();
		events.emit("snap:extra-candidates", { boxes: [{ x: 0, y: 0, width: 100, height: 100 }] });
		expect(move()).toBe(100);
		if (typeof teardown === "function") teardown();
	});

	it("an empty array clears them", () => {
		const { events, move, teardown } = dragAlone();
		events.emit("snap:extra-candidates", { boxes: [{ x: 0, y: 0, width: 100, height: 100 }] });
		events.emit("snap:extra-candidates", { boxes: [] });
		expect(move()).toBe(105);
		if (typeof teardown === "function") teardown();
	});
});
