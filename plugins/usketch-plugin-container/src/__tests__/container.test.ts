import type { PluginContext, ShapeData, ShapeDefinition } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { setupArrange } from "../arrange.js";
import { gridLayout, stackLayout } from "../layouts.js";
import { setupSnapExclude } from "../snap-exclude.js";

const shape = (o: Partial<ShapeData> = {}): ShapeData =>
	({
		id: "s",
		type: "rect",
		x: 0,
		y: 0,
		width: 40,
		height: 20,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...o,
	}) as ShapeData;

/** Minimal PluginContext covering only what these modules touch. */
function makeCtx(defs: Record<string, ShapeDefinition["container"]>) {
	const shapes = new Map<string, ShapeData>();
	const selection = new Set<string>();
	const mutationListeners = new Set<(e: { type: string; payload?: unknown }) => void>();
	const eventListeners = new Map<string, Set<(p: unknown) => void>>();
	const emitted: Array<{ type: string; payload: unknown }> = [];

	function notifyMutation(type: string, id: string) {
		for (const fn of mutationListeners) fn({ type, payload: { id } });
	}

	const ctx = {
		store: {
			getShapes: () => shapes,
			getShape: (id: string) => shapes.get(id),
			getSelection: () => selection,
			addShape(s: ShapeData) {
				shapes.set(s.id, s);
				notifyMutation("shape:added", s.id);
			},
			updateShape(id: string, patch: Partial<ShapeData>) {
				const cur = shapes.get(id);
				if (!cur) return;
				shapes.set(id, { ...cur, ...patch });
				notifyMutation("shape:updated", id);
			},
			onMutation(fn: (e: { type: string; payload?: unknown }) => void) {
				mutationListeners.add(fn);
				return () => mutationListeners.delete(fn);
			},
		},
		shapes: {
			get: (type: string) => ({ container: defs[type] }) as ShapeDefinition,
		},
		events: {
			emit(type: string, payload: unknown) {
				emitted.push({ type, payload });
				for (const fn of eventListeners.get(type) ?? []) fn(payload);
			},
			on(type: string, fn: (p: unknown) => void) {
				const bucket = eventListeners.get(type) ?? new Set();
				bucket.add(fn);
				eventListeners.set(type, bucket);
				return () => bucket.delete(fn);
			},
		},
	} as unknown as PluginContext;

	return { ctx, shapes, selection, emitted };
}

describe("layouts", () => {
	it("stackLayout arranges children vertically with padding/gap", () => {
		const container = shape({ id: "c", x: 100, y: 100, width: 240, height: 180 });
		const children = [shape({ id: "a", height: 40 }), shape({ id: "b", height: 40 })];
		const patches = stackLayout({ padding: 16, gap: 8 })({ container, children });
		expect(patches).toEqual([
			{ id: "a", patch: { x: 116, y: 116, width: 208 } },
			{ id: "b", patch: { x: 116, y: 164, width: 208 } }, // 116 + 40 + 8
		]);
	});

	it("stackLayout clamps width/height to >= 0 for tiny containers", () => {
		const container = shape({ id: "c", x: 0, y: 0, width: 10, height: 10 });
		const [v] = stackLayout({ padding: 16 })({ container, children: [shape({ id: "a" })] });
		expect(v.patch.width).toBe(0); // 10 - 32 clamped to 0, not negative
		const [h] = stackLayout({ padding: 16, direction: "horizontal" })({
			container,
			children: [shape({ id: "a" })],
		});
		expect(h.patch.height).toBe(0);
	});

	it("gridLayout guards columns <= 0 (no division by zero / negative widths)", () => {
		const container = shape({ id: "c", x: 0, y: 0, width: 100, height: 100 });
		const patches = gridLayout({ columns: 0, padding: 10, gap: 10 })({
			container,
			children: [shape({ id: "a" }), shape({ id: "b" })],
		});
		for (const p of patches) {
			expect(Number.isFinite(p.patch.width)).toBe(true);
			expect(p.patch.width as number).toBeGreaterThanOrEqual(0);
		}
	});

	it("gridLayout wraps children into columns", () => {
		const container = shape({ id: "c", x: 0, y: 0, width: 220, height: 400 });
		const children = [
			shape({ id: "a", height: 30 }),
			shape({ id: "b", height: 50 }),
			shape({ id: "c2", height: 30 }),
		];
		const patches = gridLayout({ columns: 2, padding: 10, gap: 10 })({ container, children });
		// inner width 200, cellWidth = (200 - 10) / 2 = 95
		expect(patches[0]).toEqual({ id: "a", patch: { x: 10, y: 10, width: 95 } });
		expect(patches[1]).toEqual({ id: "b", patch: { x: 115, y: 10, width: 95 } });
		// third wraps to next row: rowY = 10 + max(30,50) + 10 = 70
		expect(patches[2]).toEqual({ id: "c2", patch: { x: 10, y: 70, width: 95 } });
	});
});

describe("setupSnapExclude", () => {
	it("excludes a child whose container parent is selected, not otherwise", () => {
		const { ctx, shapes, selection, emitted } = makeCtx({
			frame: { selectableChildren: true },
			rect: undefined,
		});
		shapes.set("frame", shape({ id: "frame", type: "frame", width: 200, height: 200 }));
		shapes.set("child", shape({ id: "child", type: "rect", parentId: "frame" }));
		shapes.set("loose", shape({ id: "loose", type: "rect" }));

		const stop = setupSnapExclude(ctx);
		const configure = emitted.find((e) => e.type === "snap:configure");
		const exclude = (configure?.payload as { excludeTargets: (s: ShapeData) => boolean })
			.excludeTargets;

		// Parent not selected → child not excluded.
		expect(exclude(shapes.get("child") as ShapeData)).toBe(false);
		// Parent selected → child excluded.
		selection.add("frame");
		expect(exclude(shapes.get("child") as ShapeData)).toBe(true);
		// Non-child never excluded.
		expect(exclude(shapes.get("loose") as ShapeData)).toBe(false);

		// Deeply-nested descendant excluded when an ancestor container is selected.
		shapes.set("grandchild", shape({ id: "grandchild", type: "rect", parentId: "child" }));
		expect(exclude(shapes.get("grandchild") as ShapeData)).toBe(true);

		stop();
		// Teardown clears the predicate.
		const last = emitted[emitted.length - 1];
		expect(last.type).toBe("snap:configure");
		expect((last.payload as { excludeTargets?: unknown }).excludeTargets).toBeUndefined();
	});
});

describe("setupArrange", () => {
	it("lays out a container's children on pointer up and does not loop", () => {
		vi.useFakeTimers();
		const layout = vi.fn(stackLayout({ padding: 0, gap: 0, direction: "vertical" }));
		const { ctx, shapes } = makeCtx({ frame: { selectableChildren: true, layout } });
		shapes.set("frame", shape({ id: "frame", type: "frame", x: 0, y: 0, width: 100, height: 100 }));
		shapes.set("a", shape({ id: "a", type: "rect", parentId: "frame", height: 20 }));
		shapes.set("b", shape({ id: "b", type: "rect", parentId: "frame", height: 20 }));

		const stop = setupArrange(ctx);
		// Simulate a drag that touches the container: pointer down, the container
		// moves (recorded as dirty), then pointer up flushes the re-layout.
		ctx.events.emit("canvas:pointerdown", {});
		ctx.store.updateShape("frame", { x: 0 });
		ctx.events.emit("canvas:pointerup", {});
		vi.runAllTimers();

		// Children stacked: a at y=0, b at y=20; both stretched to width 100.
		expect(shapes.get("a")).toMatchObject({ x: 0, y: 0, width: 100 });
		expect(shapes.get("b")).toMatchObject({ x: 0, y: 20, width: 100 });
		// The layout's own updateShape calls must not re-trigger arrange (no loop):
		// exactly one layout pass from the single pointerup.
		expect(layout).toHaveBeenCalledTimes(1);

		stop();
		vi.useRealTimers();
	});
});
