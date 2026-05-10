import { describe, expect, it } from "vitest";
import { startRotateSession } from "../rotate.js";
import { createTestToolContext, makePointerEvent, makeShape } from "./test-helpers.js";

describe("startRotateSession", () => {
	it("rotates a shape by the angle delta from session start", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		// Session starts with the pointer at angle 0° from center (50, 50).
		const session = startRotateSession({
			ctx,
			shapeId: "a",
			center: { x: 50, y: 50 },
			startAngle: 0,
			startRotation: 0,
		});
		// Move the pointer 90° counter-clockwise (in screen space, +y is down).
		session.update(makePointerEvent({ x: 50, y: 100 }));
		expect(ctx.store.getShape("a")?.rotation).toBeCloseTo(90, 5);
	});

	it("snaps to 15° increments when shiftKey is held", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		const session = startRotateSession({
			ctx,
			shapeId: "a",
			center: { x: 50, y: 50 },
			startAngle: 0,
			startRotation: 0,
			snapStep: 15,
		});
		// Pointer at ~91° → with shift, should snap to 90°.
		session.update(makePointerEvent({ x: 49, y: 100 }, { shiftKey: true }));
		const shape = ctx.store.getShape("a");
		expect(shape?.rotation).toBe(90);
	});

	it("rotates child shapes around the same center as the container", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "g", type: "group", x: 0, y: 0, width: 100, height: 100 }));
		// Child positioned to the right of the group center.
		ctx.store.addShape(
			makeShape({
				id: "child",
				x: 70,
				y: 40,
				width: 20,
				height: 20,
				parentId: "g",
			}),
		);
		const session = startRotateSession({
			ctx,
			shapeId: "g",
			center: { x: 50, y: 50 },
			startAngle: 0,
			startRotation: 0,
		});
		// 90° rotation: child should swing from "right of center" to "below center".
		session.update(makePointerEvent({ x: 50, y: 100 }));
		const child = ctx.store.getShape("child");
		// Child center was at (80, 50) — after 90° (atan2 convention), → (50, 80).
		expect(child?.x).toBeCloseTo(40, 1);
		expect(child?.y).toBeCloseTo(70, 1);
	});

	it("commit() round-trips through the command (execute + undo)", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		const session = startRotateSession({
			ctx,
			shapeId: "a",
			center: { x: 50, y: 50 },
			startAngle: 0,
			startRotation: 0,
		});
		session.update(makePointerEvent({ x: 50, y: 100 }));
		const result = session.commit();
		expect(result).not.toBeNull();
		// Reverted to 0° pre-execute.
		expect(ctx.store.getShape("a")?.rotation).toBe(0);
		ctx.commands.execute(result!.command);
		expect(ctx.store.getShape("a")?.rotation).toBeCloseTo(90, 5);
		ctx.commands.undo();
		expect(ctx.store.getShape("a")?.rotation).toBe(0);
	});
});
