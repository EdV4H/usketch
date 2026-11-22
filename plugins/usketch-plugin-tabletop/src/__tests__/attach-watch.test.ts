import type { PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupAttachWatch, ZONE_ATTACHED_EVENT, ZONE_DETACHED_EVENT } from "../attach-watch.js";
import { createZoneShape } from "../zone.js";

const card = (o: Partial<ShapeData> = {}): ShapeData =>
	({ id: "c", type: "card", x: 0, y: 0, width: 100, height: 140, zIndex: "a1", ...o }) as ShapeData;

/** Minimal PluginContext: a shape map and an event bus. */
function makeCtx(initial: ShapeData[]) {
	const shapes = new Map(initial.map((s) => [s.id, s]));
	const listeners = new Map<string, Set<(p: unknown) => void>>();
	const emitted: Array<{ type: string; payload: unknown }> = [];
	const ctx = {
		store: {
			getShape: (id: string) => shapes.get(id),
			getShapesSorted: () => [...shapes.values()],
			updateShape(id: string, patch: Partial<ShapeData>) {
				const cur = shapes.get(id);
				if (cur) shapes.set(id, { ...cur, ...patch });
			},
		},
		events: {
			emit(type: string, payload: unknown) {
				emitted.push({ type, payload });
				for (const fn of listeners.get(type) ?? []) fn(payload);
			},
			on(type: string, fn: (p: unknown) => void) {
				const bucket = listeners.get(type) ?? new Set();
				bucket.add(fn);
				listeners.set(type, bucket);
				return () => bucket.delete(fn);
			},
		},
	} as unknown as PluginContext;
	/** A move ends; `reparent` stands in for the container plugin's attacher. */
	const moveEnd = (ids: string[], reparent: () => void) => {
		ctx.events.emit("shapes:move-end", { shapeIds: ids });
		reparent();
		vi.runAllTimers();
	};
	return { ctx, shapes, emitted, moveEnd };
}

describe("setupAttachWatch", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("raises a dropped shape to the top and turns it to the zone's face", () => {
		const zone = createZoneShape({ id: "z", x: 0, y: 0, face: "down", zIndex: "a2" });
		const { ctx, shapes, emitted, moveEnd } = makeCtx([zone, card()]);
		const turnFace = vi.fn(() => ({ meta: { isFlipped: true } as ShapeData["meta"] }));
		const onAttach = vi.fn();
		setupAttachWatch(ctx, { turnFace, onAttach });

		moveEnd(["c"], () => ctx.store.updateShape("c", { parentId: "z" }));

		const moved = shapes.get("c");
		expect(turnFace).toHaveBeenCalledWith(expect.objectContaining({ id: "c" }), "down");
		expect(moved?.meta).toEqual({ isFlipped: true });
		expect((moved?.zIndex ?? "") > "a2").toBe(true);
		expect(onAttach).toHaveBeenCalledWith({ zoneId: "z", shapeId: "c" });
		expect(emitted.map((e) => e.type)).toContain(ZONE_ATTACHED_EVENT);
	});

	it("keeps the stacking order of shapes dropped together, whatever the selection order", () => {
		const zone = createZoneShape({ id: "z", x: 0, y: 0, arrange: "spread", zIndex: "a0" });
		const { ctx, shapes, moveEnd } = makeCtx([
			zone,
			card({ id: "A", zIndex: "a1" }),
			card({ id: "B", zIndex: "a2" }),
			card({ id: "C", zIndex: "a3" }),
		]);
		setupAttachWatch(ctx, {});

		moveEnd(["C", "A", "B"], () => {
			for (const id of ["A", "B", "C"]) ctx.store.updateShape(id, { parentId: "z" });
		});

		const order = ["A", "B", "C"]
			.map((id) => shapes.get(id) as ShapeData)
			.sort((a, b) => (a.zIndex < b.zIndex ? -1 : 1))
			.map((s) => s.id);
		expect(order).toEqual(["A", "B", "C"]);
		expect((shapes.get("A")?.zIndex ?? "") > "a3").toBe(true);
	});

	it("keeps the face and order of a free zone set to keep", () => {
		const zone = createZoneShape({ id: "z", x: 0, y: 0, arrange: "free", zIndex: "a2" });
		const { ctx, shapes, moveEnd } = makeCtx([zone, card()]);
		const turnFace = vi.fn();
		setupAttachWatch(ctx, { turnFace });

		moveEnd(["c"], () => ctx.store.updateShape("c", { parentId: "z" }));

		expect(turnFace).not.toHaveBeenCalled();
		expect(shapes.get("c")?.zIndex).toBe("a1");
	});

	it("reports a shape taken out of a zone", () => {
		const zone = createZoneShape({ id: "z", x: 0, y: 0 });
		const { ctx, emitted, moveEnd } = makeCtx([zone, card({ parentId: "z" })]);
		const onDetach = vi.fn();
		setupAttachWatch(ctx, { onDetach });

		moveEnd(["c"], () => ctx.store.updateShape("c", { parentId: undefined }));

		expect(onDetach).toHaveBeenCalledWith({ zoneId: "z", shapeId: "c" });
		expect(emitted.map((e) => e.type)).toEqual(["shapes:move-end", ZONE_DETACHED_EVENT]);
	});

	it("does nothing when the parent did not change, or after teardown", () => {
		const zone = createZoneShape({ id: "z", x: 0, y: 0 });
		const { ctx, emitted, moveEnd } = makeCtx([zone, card({ parentId: "z" })]);
		const off = setupAttachWatch(ctx, {});
		moveEnd(["c"], () => {});
		expect(emitted.map((e) => e.type)).toEqual(["shapes:move-end"]);

		ctx.events.emit("shapes:move-end", { shapeIds: ["c"] });
		off();
		ctx.store.updateShape("c", { parentId: undefined });
		vi.runAllTimers();
		expect(emitted.map((e) => e.type)).toEqual(["shapes:move-end", "shapes:move-end"]);
	});
});
