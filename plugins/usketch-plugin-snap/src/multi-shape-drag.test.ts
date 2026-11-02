import type { BoundingBox, ShapeData } from "@edv4h/usketch-shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSnapPlugin } from "./plugin.js";

// The plugin reads window size for viewport culling and listens for keys.
const g = globalThis as unknown as { window?: unknown };
const hadWindow = "window" in g;
const prevWindow = g.window;
beforeAll(() => {
	g.window = {
		innerWidth: 1920,
		innerHeight: 1080,
		addEventListener() {},
		removeEventListener() {},
	};
});
afterAll(() => {
	if (hadWindow) g.window = prevWindow;
	else delete g.window;
});

type Listener = (p: unknown) => void;

function rect(id: string, x: number, y: number): ShapeData {
	return { id, type: "rect", x, y, width: 100, height: 80 } as ShapeData;
}

function setup(initial: ShapeData[], selected: string[]) {
	const shapes = new Map(initial.map((s) => [s.id, s]));
	let getShapeCalls = 0;
	const listeners = new Map<string, Set<Listener>>();
	const selection: ReadonlySet<string> = new Set(selected);
	const store = {
		getShape: (id: string) => {
			getShapeCalls++;
			return shapes.get(id);
		},
		getShapes: () => shapes,
		getSelection: () => selection,
		getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
		updateShape(id: string, u: Partial<ShapeData>) {
			const s = shapes.get(id);
			if (s) shapes.set(id, { ...s, ...u } as ShapeData);
		},
	};
	const bounds = (s: ShapeData): BoundingBox => ({
		x: s.x,
		y: s.y,
		width: s.width,
		height: s.height,
	});
	const ctx = {
		store,
		shapes: { get: () => ({ getBounds: bounds }) },
		events: {
			on(name: string, fn: Listener) {
				let set = listeners.get(name);
				if (!set) {
					set = new Set();
					listeners.set(name, set);
				}
				set.add(fn);
				return () => set?.delete(fn);
			},
			emit(name: string, p: unknown) {
				for (const fn of listeners.get(name) ?? []) fn(p);
			},
		},
		actions: { register: () => () => {} },
		layers: { register() {}, unregister() {} },
	};
	const teardown = createSnapPlugin().setup(ctx as never) as () => void;
	ctx.events.emit("canvas:pointerdown", {});
	return {
		shapes,
		store,
		teardown,
		resetCalls: () => {
			getShapeCalls = 0;
		},
		calls: () => getShapeCalls,
	};
}

describe("multi-shape drag", () => {
	it("applies the first shape's snap delta to every dragged shape in the frame", async () => {
		// Selection spans x 0..220; the target's left edge is at 300.
		const { shapes, store, teardown } = setup(
			[rect("a", 0, 0), rect("b", 120, 0), rect("t", 300, 0)],
			["a", "b"],
		);
		// Moving by 75 puts the selection's right edge at 295 → snaps +5 to 300.
		store.updateShape("a", { x: 75, y: 0 });
		store.updateShape("b", { x: 195, y: 0 });
		await Promise.resolve();
		expect(shapes.get("a")?.x).toBe(80);
		expect(shapes.get("b")?.x).toBe(200);
		teardown();
	});

	it("does not rescan the whole selection for every dragged shape", async () => {
		const n = 200;
		const initial: ShapeData[] = [];
		const ids: string[] = [];
		for (let i = 0; i < n; i++) {
			initial.push(rect(`s${i}`, (i % 20) * 150, Math.floor(i / 20) * 150));
			ids.push(`s${i}`);
		}
		const { store, teardown, resetCalls, calls } = setup(initial, ids);
		resetCalls();
		for (const s of initial) store.updateShape(s.id, { x: s.x + 3, y: s.y + 2 });
		await Promise.resolve();
		// One bounding-box pass for the first shape plus a constant number of
		// lookups per shape — not n per shape (n² = 40 000).
		expect(calls()).toBeLessThan(n * 5);
		teardown();
	});
});
