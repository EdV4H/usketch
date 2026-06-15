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

		it("addShape: stamps createdAt and updatedAt", () => {
			const store = createBoardStore();
			const before = Date.now();
			store.addShape(makeShape({ id: "s1" }));
			const after = Date.now();

			const shape = store.getShape("s1")!;
			const createdAt = shape.createdAt as number;
			const updatedAt = shape.updatedAt as number;
			expect(createdAt).toBeGreaterThanOrEqual(before);
			expect(createdAt).toBeLessThanOrEqual(after);
			expect(updatedAt).toBeGreaterThanOrEqual(before);
		});

		it("addShape: preserves existing createdAt", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1", createdAt: 12345 }));

			const shape = store.getShape("s1")!;
			expect(shape.createdAt).toBe(12345);
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

		it("updateShape: stamps updatedAt", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			const before = Date.now();

			store.updateShape("s1", { x: 10 });

			const updatedAt = store.getShape("s1")!.updatedAt as number;
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

		describe("fitToBounds", () => {
			it("centers viewport on bounds and fits with padding", () => {
				const store = createBoardStore();
				// 100x100 の領域を 1000x1000 のビューポートに padding=40 でフィット
				store.fitToBounds(
					{ x: 200, y: 300, width: 100, height: 100 },
					{ width: 1000, height: 1000 },
					40,
				);
				const vp = store.getViewport();
				// 利用可能領域 = 1000 - 80 = 920 → zoom = 920 / 100 = 9.2
				expect(vp.zoom).toBeCloseTo(9.2, 5);
				// bounds の中心 (250, 350) がビューポートの中心 (500, 500) に来る
				// → x = 500 - 250 * 9.2 = 500 - 2300 = -1800
				expect(vp.x).toBeCloseTo(500 - 250 * 9.2, 5);
				expect(vp.y).toBeCloseTo(500 - 350 * 9.2, 5);
			});

			it("clamps zoom to [0.1, 10]", () => {
				const store = createBoardStore();
				// very small bounds in large viewport → zoom would exceed 10
				store.fitToBounds({ x: 0, y: 0, width: 1, height: 1 }, { width: 1000, height: 1000 }, 0);
				expect(store.getViewport().zoom).toBe(10);

				// huge bounds → zoom would drop below 0.1
				store.fitToBounds(
					{ x: 0, y: 0, width: 1_000_000, height: 1_000_000 },
					{ width: 100, height: 100 },
					0,
				);
				expect(store.getViewport().zoom).toBe(0.1);
			});

			it("no-ops for non-positive bounds or viewport size", () => {
				const store = createBoardStore();
				const before = store.getViewport();
				store.fitToBounds({ x: 0, y: 0, width: 0, height: 100 }, { width: 800, height: 600 });
				store.fitToBounds({ x: 0, y: 0, width: 100, height: -5 }, { width: 800, height: 600 });
				store.fitToBounds({ x: 0, y: 0, width: 100, height: 100 }, { width: 0, height: 600 });
				expect(store.getViewport()).toEqual(before);
			});

			it("defaults padding to 40 when omitted", () => {
				const store = createBoardStore();
				store.fitToBounds({ x: 0, y: 0, width: 100, height: 100 }, { width: 1000, height: 1000 });
				// zoom = (1000 - 80) / 100 = 9.2
				expect(store.getViewport().zoom).toBeCloseTo(9.2, 5);
			});

			it("emits viewport:changed mutation", () => {
				const store = createBoardStore();
				const listener = vi.fn();
				store.onMutation(listener);
				store.fitToBounds({ x: 0, y: 0, width: 100, height: 100 }, { width: 1000, height: 1000 });
				expect(listener).toHaveBeenCalledWith(
					expect.objectContaining({ type: "viewport:changed" }),
				);
			});
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

		it("defaultToolId: starts at 'select'", () => {
			const store = createBoardStore();
			expect(store.getDefaultToolId()).toBe("select");
		});

		it("setDefaultToolId: updates the default and notifies", () => {
			const store = createBoardStore();
			const listener = vi.fn();
			const events: StoreEvent[] = [];
			store.subscribe(listener);
			store.onMutation((e) => events.push(e));
			store.setDefaultToolId("pan");
			expect(store.getDefaultToolId()).toBe("pan");
			expect(store.getActiveToolId()).toBe("select");
			expect(listener).toHaveBeenCalled();
			expect(events).toEqual([{ type: "default-tool:changed", payload: { id: "pan" } }]);
		});

		it("setDefaultToolId: no-op for same id", () => {
			const store = createBoardStore();
			const listener = vi.fn();
			store.subscribe(listener);
			store.setDefaultToolId("select"); // already default
			expect(listener).not.toHaveBeenCalled();
		});

		it("resetToDefaultTool: returns to default and notifies", () => {
			const store = createBoardStore();
			store.setActiveToolId("pan");
			const listener = vi.fn();
			store.subscribe(listener);
			store.resetToDefaultTool();
			expect(store.getActiveToolId()).toBe("select");
			expect(listener).toHaveBeenCalled();
		});

		it("resetToDefaultTool: respects custom default", () => {
			const store = createBoardStore();
			store.setDefaultToolId("pan");
			store.setActiveToolId("draw");
			store.resetToDefaultTool();
			expect(store.getActiveToolId()).toBe("pan");
		});

		it("resetToDefaultTool: no-op when already on default", () => {
			const store = createBoardStore();
			const listener = vi.fn();
			store.subscribe(listener);
			store.resetToDefaultTool();
			expect(listener).not.toHaveBeenCalled();
		});

		it("resetToDefaultTool: emits tool:changed mutation event", () => {
			const store = createBoardStore();
			store.setActiveToolId("pan");
			const events: StoreEvent[] = [];
			store.onMutation((e) => events.push(e));
			store.resetToDefaultTool();
			expect(events).toEqual([{ type: "tool:changed", payload: { id: "select" } }]);
		});
	});

	describe("Mutation Events", () => {
		it("emits shape:added on addShape", () => {
			const store = createBoardStore();
			const events: StoreEvent[] = [];
			store.onMutation((e) => events.push(e));

			store.addShape(makeShape({ id: "s1" }));

			expect(events).toEqual([{ type: "shape:added", payload: { id: "s1", ids: ["s1"] } }]);
		});

		it("emits shape:updated with before/after on updateShape", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1", x: 0 }));
			const events: StoreEvent[] = [];
			store.onMutation((e) => events.push(e));

			store.updateShape("s1", { x: 10 });

			expect(events).toHaveLength(1);
			const e = events[0];
			// Runtime-guard on `type` so the discriminated union narrows `payload`
			// to the typed `ShapeChange & { ids }` shape — no structural cast, so
			// the test follows the type definition at compile time.
			if (e.type !== "shape:updated") throw new Error(`expected shape:updated, got ${e.type}`);
			expect(e.payload.id).toBe("s1");
			expect(e.payload.ids).toEqual(["s1"]);
			// 追従系が自前で前回位置を持たなくても差分が取れる
			expect(e.payload.before.x).toBe(0);
			expect(e.payload.after.x).toBe(10);
		});

		it("emits shape:removed and selection:changed on deleteShape of selected", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			store.setSelection(["s1"]);
			const events: StoreEvent[] = [];
			store.onMutation((e) => events.push(e));

			store.deleteShape("s1");

			expect(events.map((e) => e.type)).toEqual(["shape:removed", "selection:changed"]);
			// Verify the removed payload explicitly so a dropped `ids` is caught.
			const removed = events[0];
			if (removed.type !== "shape:removed") throw new Error("expected shape:removed first");
			expect(removed.payload.id).toBe("s1");
			expect(removed.payload.ids).toEqual(["s1"]);
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
