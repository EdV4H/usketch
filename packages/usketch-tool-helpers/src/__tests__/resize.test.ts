import { describe, expect, it } from "vitest";
import { startResizeSession } from "../resize.js";
import { createTestToolContext, makePointerEvent, makeShape } from "./test-helpers.js";

describe("startResizeSession (single)", () => {
	it("growing the SE handle increases width and height", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		const session = startResizeSession({
			kind: "single",
			ctx,
			shapeId: "a",
			handle: "se",
			startPoint: { x: 100, y: 100 },
		});
		session.update(makePointerEvent({ x: 150, y: 130 }));
		const shape = ctx.store.getShape("a")!;
		expect(shape.width).toBe(150);
		expect(shape.height).toBe(130);
	});

	it("commit() round-trips through the command (execute + undo)", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		const session = startResizeSession({
			kind: "single",
			ctx,
			shapeId: "a",
			handle: "se",
			startPoint: { x: 100, y: 100 },
		});
		session.update(makePointerEvent({ x: 200, y: 150 }));
		const result = session.commit();
		expect(result).not.toBeNull();
		// Reverted to "before" so execute() replays.
		expect(ctx.store.getShape("a")?.width).toBe(100);
		ctx.commands.execute(result!.command);
		expect(ctx.store.getShape("a")?.width).toBe(200);
		ctx.commands.undo();
		expect(ctx.store.getShape("a")?.width).toBe(100);
	});

	it("cancel() restores the original shape data", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		const session = startResizeSession({
			kind: "single",
			ctx,
			shapeId: "a",
			handle: "se",
			startPoint: { x: 100, y: 100 },
		});
		session.update(makePointerEvent({ x: 200, y: 200 }));
		expect(ctx.store.getShape("a")?.width).toBe(200);
		session.cancel();
		expect(ctx.store.getShape("a")?.width).toBe(100);
	});

	it("returns an empty update when delta is zero", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		const session = startResizeSession({
			kind: "single",
			ctx,
			shapeId: "a",
			handle: "se",
			startPoint: { x: 100, y: 100 },
		});
		const u = session.update(makePointerEvent({ x: 100, y: 100 }));
		expect(u.updates.size).toBe(0);
	});
});

describe("startResizeSession (multi)", () => {
	it("preserves relative size ratios across the selection", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.addShape(makeShape({ id: "b", x: 200, y: 0, width: 100, height: 100 }));
		ctx.store.setSelection(["a", "b"]);

		const session = startResizeSession({
			kind: "multi",
			ctx,
			selection: new Set(["a", "b"]),
			handle: "se",
			startPoint: { x: 300, y: 100 },
			groupBounds: { x: 0, y: 0, width: 300, height: 100 },
		});
		// Drag SE handle right by 300px → group should double horizontally.
		session.update(makePointerEvent({ x: 600, y: 100 }));
		// `a` was 0..100 of a 300-wide group → 0..200 of a 600-wide one.
		// `b` was 200..300 → 400..600.
		expect(ctx.store.getShape("a")?.x).toBe(0);
		expect(ctx.store.getShape("a")?.width).toBe(200);
		expect(ctx.store.getShape("b")?.x).toBe(400);
		expect(ctx.store.getShape("b")?.width).toBe(200);
	});

	it("commit() returns null when nothing actually changed", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.addShape(makeShape({ id: "b", x: 200, y: 0, width: 100, height: 100 }));
		const session = startResizeSession({
			kind: "multi",
			ctx,
			selection: new Set(["a", "b"]),
			handle: "se",
			startPoint: { x: 300, y: 100 },
			groupBounds: { x: 0, y: 0, width: 300, height: 100 },
		});
		// No update at all — pointerdown + pointerup with zero motion.
		expect(session.commit()).toBeNull();
	});
});
