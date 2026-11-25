import type { BoundingBox, Point, ResizeHandle, ShapeData } from "@edv4h/usketch-shared";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
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

const teardowns: (() => void)[] = [];
afterEach(() => {
	for (const t of teardowns.splice(0)) t();
});

function rect(
	id: string,
	x: number,
	y: number,
	width: number,
	height: number,
	extra: Partial<ShapeData> = {},
): ShapeData {
	return { id, type: "rect", x, y, width, height, ...extra } as ShapeData;
}

/** A shape whose `resize` keeps its ratio (like an image in keep-aspect mode). */
function aspectResize(data: ShapeData, _handle: ResizeHandle, delta: Point): ShapeData {
	const width = data.width + delta.x;
	return { ...data, width, height: (width * data.height) / data.width };
}

function setup(initial: ShapeData[], selected: string[]) {
	const shapes = new Map(initial.map((s) => [s.id, s]));
	const listeners = new Map<string, Set<Listener>>();
	const selection: ReadonlySet<string> = new Set(selected);
	const store = {
		getShape: (id: string) => shapes.get(id),
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
		shapes: {
			get: (type: string) =>
				type === "aspect" ? { getBounds: bounds, resize: aspectResize } : { getBounds: bounds },
		},
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
	teardowns.push(createSnapPlugin().setup(ctx as never) as () => void);
	ctx.events.emit("canvas:pointerdown", {});
	return { shapes, store, events: ctx.events };
}

const size = (s: ShapeData | undefined) => s && { width: s.width, height: s.height };

describe("size snap while resizing", () => {
	it("squares a corner drag when width and height are close", () => {
		const { shapes, store } = setup([rect("a", 0, 0, 100, 80)], ["a"]);
		store.updateShape("a", { width: 103, height: 108 });
		expect(shapes.get("a")).toMatchObject({ x: 0, y: 0, width: 105.5, height: 105.5 });
	});

	it("keeps the anchored corner when dragging the top-left handle", () => {
		const { shapes, store } = setup([rect("a", 0, 0, 100, 80)], ["a"]);
		// nw handle: the bottom-right corner (100, 80) stays put.
		store.updateShape("a", { x: -2, y: -12, width: 102, height: 92 });
		const a = shapes.get("a");
		expect(a?.width).toBe(97);
		expect(a?.height).toBe(97);
		expect((a?.x ?? 0) + (a?.width ?? 0)).toBe(100);
		expect((a?.y ?? 0) + (a?.height ?? 0)).toBe(80);
	});

	it("gives an edge handle the other side's length", () => {
		const { shapes, store } = setup([rect("a", 0, 0, 100, 80)], ["a"]);
		store.updateShape("a", { width: 86 });
		expect(size(shapes.get("a"))).toEqual({ width: 80, height: 80 });
	});

	it("matches the width of another shape", () => {
		const { shapes, store } = setup(
			[rect("a", 0, 0, 100, 80), rect("t", 400, 300, 150, 40)],
			["a"],
		);
		store.updateShape("a", { width: 146 });
		expect(size(shapes.get("a"))).toEqual({ width: 150, height: 80 });
	});

	it("lets an edge alignment win and squares the other side to it", () => {
		// t's right edge is at x = 120; a's corner drag lands at 118 × 125.
		const { shapes, store } = setup([rect("a", 0, 0, 100, 80), rect("t", 20, 400, 100, 30)], ["a"]);
		store.updateShape("a", { width: 118, height: 125 });
		expect(size(shapes.get("a"))).toEqual({ width: 120, height: 120 });
	});

	it("squares a rotated shape, keeping its anchored side in place", () => {
		const { shapes, store } = setup([rect("a", 0, 0, 100, 80, { rotation: 90 })], ["a"]);
		// Turned 90°, local width runs down the board. The tool shrinks the width
		// to 86 with the local left edge (the top on screen, y = -10) fixed: the
		// center moves up 7 from (50, 40).
		store.updateShape("a", { x: 7, y: -7, width: 86, height: 80 });
		const a = shapes.get("a");
		expect(size(a)).toEqual({ width: 80, height: 80 });
		// Width 80 with the top still at y = -10 → the center is at (50, 30).
		expect((a?.x ?? 0) + (a?.width ?? 0) / 2).toBeCloseTo(50);
		expect((a?.y ?? 0) + (a?.height ?? 0) / 2).toBeCloseTo(30);
	});

	it("doesn't size-snap an aspect-locked shape", () => {
		const { shapes, store } = setup(
			[{ ...rect("a", 0, 0, 100, 80), type: "aspect" } as ShapeData],
			["a"],
		);
		store.updateShape("a", { width: 103, height: 82.4 });
		expect(size(shapes.get("a"))).toEqual({ width: 103, height: 82.4 });
	});

	it("doesn't size-snap shapes of a multi-selection resize", () => {
		const { shapes, store } = setup(
			[rect("a", 0, 0, 100, 80), rect("b", 1000, 1000, 50, 50)],
			["a", "b"],
		);
		store.updateShape("a", { width: 103, height: 108 });
		expect(size(shapes.get("a"))).toEqual({ width: 103, height: 108 });
	});

	it("can be turned off", () => {
		const { shapes, store, events } = setup([rect("a", 0, 0, 100, 80)], ["a"]);
		events.emit("snap:configure", { sizeSnap: false });
		store.updateShape("a", { width: 103, height: 108 });
		expect(size(shapes.get("a"))).toEqual({ width: 103, height: 108 });
	});
});
