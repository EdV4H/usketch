import { describe, expect, it } from "vitest";
import { startDragSession } from "../drag.js";
import { createTestToolContext, makePointerEvent, makeShape } from "./test-helpers.js";

describe("startDragSession", () => {
	it("translates a single shape by the pointer delta", () => {
		const ctx = createTestToolContext();
		const a = makeShape({ id: "a", x: 10, y: 20 });
		ctx.store.addShape(a);

		const session = startDragSession({
			ctx,
			startPoint: { x: 0, y: 0 },
			shapeIds: ["a"],
		});
		session.update(makePointerEvent({ x: 5, y: 7 }));
		const moved = ctx.store.getShape("a");
		expect(moved?.x).toBe(15);
		expect(moved?.y).toBe(27);
	});

	it("translates multiple selected shapes by the same delta", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0 }));
		ctx.store.addShape(makeShape({ id: "b", x: 100, y: 0 }));
		ctx.store.setSelection(["a", "b"]);

		const session = startDragSession({
			ctx,
			startPoint: { x: 0, y: 0 },
			shapeIds: ["a", "b"],
		});
		session.update(makePointerEvent({ x: 50, y: 0 }));
		expect(ctx.store.getShape("a")?.x).toBe(50);
		expect(ctx.store.getShape("b")?.x).toBe(150);
	});

	it("includes descendants of containers (group/frame/island) when the parent is dragged", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "g", type: "group", x: 0, y: 0 }));
		ctx.store.addShape(makeShape({ id: "child", x: 10, y: 10, parentId: "g" }));
		ctx.store.setSelection(["g"]);

		const session = startDragSession({
			ctx,
			startPoint: { x: 0, y: 0 },
			shapeIds: ["g"],
		});
		session.update(makePointerEvent({ x: 30, y: 0 }));
		// Child follows the parent.
		expect(ctx.store.getShape("g")?.x).toBe(30);
		expect(ctx.store.getShape("child")?.x).toBe(40);
	});

	it("commit() returns a Command that the caller can execute (round-trip undo)", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0 }));
		ctx.store.setSelection(["a"]);
		const session = startDragSession({
			ctx,
			startPoint: { x: 0, y: 0 },
			shapeIds: ["a"],
		});
		session.update(makePointerEvent({ x: 25, y: 25 }));
		const result = session.commit();
		expect(result).not.toBeNull();
		// Helpers revert to "before" so the caller's execute() replays the move.
		expect(ctx.store.getShape("a")?.x).toBe(0);
		ctx.commands.execute(result!.command);
		expect(ctx.store.getShape("a")?.x).toBe(25);
		ctx.commands.undo();
		expect(ctx.store.getShape("a")?.x).toBe(0);
	});

	it("commit() returns null when the drag distance is below the noise floor", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0 }));
		ctx.store.setSelection(["a"]);
		const session = startDragSession({
			ctx,
			startPoint: { x: 0, y: 0 },
			shapeIds: ["a"],
		});
		// Sub-pixel jitter that the move tracker classifies as "no real move".
		session.update(makePointerEvent({ x: 0.1, y: 0.1 }));
		expect(session.commit()).toBeNull();
	});

	it("calls the onSnap hook so callers can adjust the delta before it lands", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0 }));
		ctx.store.setSelection(["a"]);
		const session = startDragSession({
			ctx,
			startPoint: { x: 0, y: 0 },
			shapeIds: ["a"],
			onSnap: ({ x, y }) => ({ x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 }),
		});
		session.update(makePointerEvent({ x: 23, y: 7 }));
		// Snap rounds 23 → 20 and 7 → 10.
		expect(ctx.store.getShape("a")?.x).toBe(20);
		expect(ctx.store.getShape("a")?.y).toBe(10);
	});
});
