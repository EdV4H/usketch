import type { ShapeData, StoreEvent } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createBoardStore } from "../board-store.js";

function makeShape(overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: overrides.id ?? "s1",
		type: overrides.type ?? "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...overrides,
	};
}

describe("BoardStore", () => {
	describe("Shape Operations", () => {
		it("addShape: adds a shape and notifies listeners", () => {
			const store = createBoardStore();
			const listener = vi.fn();
			store.subscribe(listener);

			store.addShape(makeShape({ id: "s1" }));

			expect(store.getShapes().size).toBe(1);
			expect(store.getShape("s1")).toBeDefined();
			expect(listener).toHaveBeenCalled();
		});

		it("addShape: stamps _createdAt and _updatedAt", () => {
			const store = createBoardStore();
			const before = Date.now();
			store.addShape(makeShape({ id: "s1" }));
			const after = Date.now();

			const shape = store.getShape("s1")!;
			const createdAt = shape._createdAt as number;
			const updatedAt = shape._updatedAt as number;
			expect(createdAt).toBeGreaterThanOrEqual(before);
			expect(createdAt).toBeLessThanOrEqual(after);
			expect(updatedAt).toBeGreaterThanOrEqual(before);
		});

		it("addShape: preserves existing _createdAt", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1", _createdAt: 12345 } as ShapeData));

			const shape = store.getShape("s1")!;
			expect(shape._createdAt).toBe(12345);
		});

		it("updateShape: updates existing shape", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1", x: 0 }));

			store.updateShape("s1", { x: 50 });

			expect(store.getShape("s1")!.x).toBe(50);
		});

		it("updateShape: ignores non-existent shape", () => {
			const store = createBoardStore();
			const listener = vi.fn();
			store.subscribe(listener);

			store.updateShape("nonexistent", { x: 50 });

			expect(listener).not.toHaveBeenCalled();
		});

		it("updateShape: stamps _updatedAt", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			const before = Date.now();

			store.updateShape("s1", { x: 10 });

			const updatedAt = store.getShape("s1")!._updatedAt as number;
			expect(updatedAt).toBeGreaterThanOrEqual(before);
		});

		it("deleteShape: removes shape and notifies", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			const listener = vi.fn();
			store.subscribe(listener);

			store.deleteShape("s1");

			expect(store.getShapes().size).toBe(0);
			expect(store.getShape("s1")).toBeUndefined();
			expect(listener).toHaveBeenCalled();
		});

		it("deleteShape: also removes from selection", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			store.setSelection(["s1"]);

			store.deleteShape("s1");

			expect(store.getSelection().size).toBe(0);
		});

		it("deleteShape: no-op for non-existent shape", () => {
			const store = createBoardStore();
			const listener = vi.fn();
			store.subscribe(listener);

			store.deleteShape("nonexistent");

			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe("Selection", () => {
		it("setSelection: sets selection", () => {
			const store = createBoardStore();
			store.setSelection(["s1", "s2"]);
			expect(store.getSelection().size).toBe(2);
			expect(store.getSelection().has("s1")).toBe(true);
		});

		it("addToSelection: adds incrementally", () => {
			const store = createBoardStore();
			store.setSelection(["s1"]);
			store.addToSelection("s2");
			expect(store.getSelection().size).toBe(2);
		});

		it("removeFromSelection: removes single item", () => {
			const store = createBoardStore();
			store.setSelection(["s1", "s2"]);
			store.removeFromSelection("s1");
			expect(store.getSelection().size).toBe(1);
			expect(store.getSelection().has("s2")).toBe(true);
		});

		it("clearSelection: clears all", () => {
			const store = createBoardStore();
			store.setSelection(["s1", "s2"]);
			store.clearSelection();
			expect(store.getSelection().size).toBe(0);
		});

		it("clearSelection: no-op when already empty", () => {
			const store = createBoardStore();
			const listener = vi.fn();
			store.subscribe(listener);
			store.clearSelection();
			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe("Viewport", () => {
		it("panBy: shifts viewport position", () => {
			const store = createBoardStore();
			store.panBy(100, 200);
			const vp = store.getViewport();
			expect(vp.x).toBe(100);
			expect(vp.y).toBe(200);
		});

		it("zoomTo: clamps zoom to [0.1, 10]", () => {
			const store = createBoardStore();
			store.zoomTo(0.01, { x: 0, y: 0 });
			expect(store.getViewport().zoom).toBe(0.1);

			store.zoomTo(100, { x: 0, y: 0 });
			expect(store.getViewport().zoom).toBe(10);
		});
	});

	describe("Tool", () => {
		it("setActiveToolId: changes tool and notifies", () => {
			const store = createBoardStore();
			const listener = vi.fn();
			store.subscribe(listener);
			store.setActiveToolId("pan");
			expect(store.getActiveToolId()).toBe("pan");
			expect(listener).toHaveBeenCalled();
		});

		it("setActiveToolId: no-op for same tool", () => {
			const store = createBoardStore();
			const listener = vi.fn();
			store.subscribe(listener);
			store.setActiveToolId("select"); // default
			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe("Mutation Events", () => {
		it("emits shape:added on addShape", () => {
			const store = createBoardStore();
			const events: StoreEvent[] = [];
			store.onMutation((e) => events.push(e));

			store.addShape(makeShape({ id: "s1" }));

			expect(events).toEqual([{ type: "shape:added", payload: { id: "s1" } }]);
		});

		it("emits shape:updated on updateShape", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			const events: StoreEvent[] = [];
			store.onMutation((e) => events.push(e));

			store.updateShape("s1", { x: 10 });

			expect(events).toEqual([{ type: "shape:updated", payload: { id: "s1" } }]);
		});

		it("emits shape:removed and selection:changed on deleteShape of selected", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			store.setSelection(["s1"]);
			const events: StoreEvent[] = [];
			store.onMutation((e) => events.push(e));

			store.deleteShape("s1");

			expect(events.map((e) => e.type)).toEqual(["shape:removed", "selection:changed"]);
		});
	});

	describe("Subscribe / Unsubscribe", () => {
		it("unsubscribe stops notifications", () => {
			const store = createBoardStore();
			const listener = vi.fn();
			const unsub = store.subscribe(listener);

			store.addShape(makeShape({ id: "s1" }));
			expect(listener).toHaveBeenCalledTimes(1);

			unsub();
			store.addShape(makeShape({ id: "s2" }));
			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	describe("Z-order", () => {
		it("addShape: assigns zIndex automatically when missing", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			store.addShape(makeShape({ id: "s2" }));
			store.addShape(makeShape({ id: "s3" }));

			const s1 = store.getShape("s1")!;
			const s2 = store.getShape("s2")!;
			const s3 = store.getShape("s3")!;
			expect(typeof s1.zIndex).toBe("string");
			expect(typeof s2.zIndex).toBe("string");
			expect(typeof s3.zIndex).toBe("string");
			// Monotonic: later shapes have larger keys
			expect(s1.zIndex! < s2.zIndex!).toBe(true);
			expect(s2.zIndex! < s3.zIndex!).toBe(true);
		});

		it("addShape: respects explicit zIndex", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1", zIndex: "a5" }));
			expect(store.getShape("s1")!.zIndex).toBe("a5");
		});

		it("getShapesSorted: returns shapes in zIndex order", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			store.addShape(makeShape({ id: "s2" }));
			store.addShape(makeShape({ id: "s3" }));

			const sorted = store.getShapesSorted();
			expect(sorted.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
		});

		it("getShapesSorted: caches result and invalidates on mutation", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			store.addShape(makeShape({ id: "s2" }));
			const first = store.getShapesSorted();
			const second = store.getShapesSorted();
			expect(first).toBe(second); // same reference (cached)

			store.addShape(makeShape({ id: "s3" }));
			const third = store.getShapesSorted();
			expect(third).not.toBe(first); // cache invalidated
			expect(third.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
		});

		it("ensureZIndex: no-op when all shapes already have zIndex", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			const before = store.getShape("s1")?.zIndex;
			store.ensureZIndex();
			expect(store.getShape("s1")?.zIndex).toBe(before);
		});

		it("ensureZIndex: backfills missing keys after the current max", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "keyed1" }));
			store.addShape(makeShape({ id: "keyed2" }));
			const keyedMax = store.getShape("keyed2")?.zIndex;
			expect(typeof keyedMax).toBe("string");

			// Simulate legacy shapes loaded without a zIndex. `updateShape` with an
			// explicit `undefined` drops the key (object spread overwrites the field).
			store.addShape(makeShape({ id: "legacy1" }));
			store.addShape(makeShape({ id: "legacy2" }));
			store.updateShape("legacy1", { zIndex: undefined });
			store.updateShape("legacy2", { zIndex: undefined });
			expect(store.getShape("legacy1")?.zIndex).toBeUndefined();
			expect(store.getShape("legacy2")?.zIndex).toBeUndefined();

			store.ensureZIndex();

			const l1 = store.getShape("legacy1")?.zIndex;
			const l2 = store.getShape("legacy2")?.zIndex;
			expect(typeof l1).toBe("string");
			expect(typeof l2).toBe("string");
			// Legacy shapes land above the existing max
			expect(l1! > (keyedMax as string)).toBe(true);
			expect(l2! > (keyedMax as string)).toBe(true);
			// And preserve their relative Map-iteration order
			expect(l1! < l2!).toBe(true);
			// Keyed shapes are untouched
			expect(store.getShape("keyed2")?.zIndex).toBe(keyedMax);
		});
	});
});
