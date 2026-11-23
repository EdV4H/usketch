import type { BoundingBox, ShapeData } from "@edv4h/usketch-shared";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createSnapPlugin } from "./plugin.js";

beforeAll(() => {
	(globalThis as unknown as { window: unknown }).window = {
		innerWidth: 1000,
		innerHeight: 800,
		addEventListener() {},
		removeEventListener() {},
	};
});

function rect(id: string, x: number, y: number, parentId?: string): ShapeData {
	return { id, type: "rect", x, y, width: 100, height: 80, parentId } as ShapeData;
}

let teardown: (() => void) | null = null;
afterEach(() => {
	teardown?.();
	teardown = null;
});

/** Snap plugin on a fake store; returns a drag helper and the ids walked as parents. */
function setup(list: ShapeData[]) {
	const shapes = new Map(list.map((s) => [s.id, s]));
	const lookups: string[] = [];
	let selection: ReadonlySet<string> = new Set();
	const handlers = new Map<string, (p: unknown) => void>();
	const bounds = (s: ShapeData): BoundingBox => ({
		x: s.x,
		y: s.y,
		width: s.width,
		height: s.height,
	});
	const defs: Record<string, unknown> = {
		rect: { getBounds: bounds },
		frame: { getBounds: bounds, container: { selectableChildren: true, autoAttach: true } },
	};
	const store = {
		getShape: (id: string) => {
			lookups.push(id);
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
	const ctx = {
		store,
		shapes: { get: (t: string) => defs[t] },
		events: {
			on(name: string, fn: (p: unknown) => void) {
				handlers.set(name, fn);
				return () => handlers.delete(name);
			},
			emit(name: string, p: unknown) {
				handlers.get(name)?.(p);
			},
		},
		actions: { register: () => () => {} },
		layers: { register() {}, unregister() {} },
	};
	teardown = createSnapPlugin({ distributeSnap: false }).setup(ctx as never) as () => void;

	/** Drag `id` to (x, y) and return where snap put it. */
	function drag(id: string, x: number, y: number) {
		selection = new Set([id]);
		ctx.events.emit("canvas:pointerdown", {});
		lookups.length = 0;
		store.updateShape(id, { x, y });
		ctx.events.emit("canvas:pointerup", {});
		const s = shapes.get(id) as ShapeData;
		return { x: s.x, y: s.y };
	}
	/** Apply `patch` to `id` mid-drag (as a tool would) and return the stored shape. */
	function update(id: string, patch: Partial<ShapeData>) {
		selection = new Set([id]);
		ctx.events.emit("canvas:pointerdown", {});
		store.updateShape(id, patch);
		ctx.events.emit("canvas:pointerup", {});
		return shapes.get(id) as ShapeData;
	}
	return { drag, update, lookups };
}

describe("snap targets", () => {
	it("snaps a top-level shape to a visible top-level shape", () => {
		const { drag } = setup([rect("a", 0, 0), rect("b", 300, 200)]);
		// a's left edge lands 3px from b's left edge → snaps to x = 300.
		expect(drag("a", 303, 500).x).toBe(300);
	});

	it("ignores shapes outside the viewport", () => {
		const { drag } = setup([rect("a", 0, 0), rect("far", 5000, 0)]);
		expect(drag("a", 303, 500).x).toBe(303);
	});

	it("does not snap a top-level shape to a shape inside a frame", () => {
		const frame = { ...rect("f", 600, 0), type: "frame", width: 400, height: 300 } as ShapeData;
		const { drag } = setup([rect("a", 0, 0), frame, rect("child", 650, 100, "f")]);
		// Near the child's left edge (650) but not the frame's edges (600 / 800 / 1000).
		expect(drag("a", 653, 500).x).toBe(653);
	});

	it("snaps a shape in a frame to its siblings only", () => {
		const frame = { ...rect("f", 0, 0), type: "frame", width: 900, height: 700 } as ShapeData;
		const { drag } = setup([frame, rect("a", 10, 10, "f"), rect("sib", 400, 300, "f")]);
		expect(drag("a", 403, 500).x).toBe(400);
	});

	it("does not walk the parent chain of off-screen shapes", () => {
		const frame = { ...rect("f", 5000, 0), type: "frame", width: 300, height: 300 } as ShapeData;
		const { drag, lookups } = setup([rect("a", 0, 0), frame, rect("child", 5050, 50, "f")]);
		drag("a", 303, 500);
		expect(lookups).not.toContain("child");
		expect(lookups).not.toContain("f");
	});
});

describe("snap with rotated shapes", () => {
	it("aligns a rotated shape by the outline it is drawn with, not its un-rotated box", () => {
		// 100x100 square at 45°: drawn as a diamond reaching ~20.7 past each side of its box.
		const diamond = { ...rect("r", 600, 400), width: 100, height: 100, rotation: 45 } as ShapeData;
		const { drag } = setup([rect("t", 300, 200), diamond]);
		const reach = 50 * Math.SQRT2 - 50;
		// Put the diamond's drawn left corner 3px right of t's right edge (400).
		const moved = drag("r", 400 + reach + 3, 600);
		expect(moved.x).toBeCloseTo(400 + reach);
	});

	it("uses a rotated target's drawn outline", () => {
		const diamond = { ...rect("t", 300, 200), width: 100, height: 100, rotation: 45 } as ShapeData;
		const { drag } = setup([diamond, rect("a", 0, 500)]);
		const reach = 50 * Math.SQRT2 - 50;
		// a's left edge 3px off the diamond's drawn right corner (400 + reach).
		expect(drag("a", 400 + reach + 3, 600).x).toBeCloseTo(400 + reach);
	});

	it("never snaps a rotation (updates that carry rotation)", () => {
		const { update } = setup([rect("t", 300, 200), rect("a", 0, 500)]);
		// x would snap to 300 if this were a move.
		expect(update("a", { x: 303, y: 520, rotation: 10 }).x).toBe(303);
	});

	it("does not snap the resize of a rotated shape", () => {
		const turned = { ...rect("a", 0, 500), rotation: 30 } as ShapeData;
		const { update } = setup([rect("t", 300, 200), turned]);
		// The right edge would snap to 300 (t's left) for an unrotated shape.
		expect(update("a", { width: 303 }).width).toBe(303);
	});
});
