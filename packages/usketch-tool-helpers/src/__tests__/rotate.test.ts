import { describe, expect, it } from "vitest";
import { startMultiRotateSession, startRotateSession } from "../rotate.js";
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

describe("startMultiRotateSession", () => {
	it("各選択シェイプを共通の中心まわりに剛体回転する", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "r1", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.addShape(makeShape({ id: "r2", x: 200, y: 200, width: 100, height: 100 }));
		ctx.store.setSelection(["r1", "r2"]);

		const session = startMultiRotateSession({
			ctx,
			ids: ["r1", "r2"],
			center: { x: 150, y: 150 },
			startAngle: 0, // pointerdown to the right of center
			snapStep: 0,
		});
		// Pointer directly below center → +90° (clockwise) delta.
		session.update(makePointerEvent({ x: 150, y: 300 }));

		const r1 = ctx.store.getShape("r1");
		const r2 = ctx.store.getShape("r2");
		// r1 center (50,50) orbits to (250,50); r2 center (250,250) orbits to (50,250).
		expect(r1?.x).toBeCloseTo(200);
		expect(r1?.y).toBeCloseTo(0);
		expect(r1?.rotation).toBeCloseTo(90);
		expect(r2?.x).toBeCloseTo(0);
		expect(r2?.y).toBeCloseTo(200);
		expect(r2?.rotation).toBeCloseTo(90);
	});

	it("commit は revert してから execute/undo で往復できる", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.addShape(makeShape({ id: "b", x: 200, y: 0, width: 100, height: 100 }));
		ctx.store.setSelection(["a", "b"]);

		const session = startMultiRotateSession({
			ctx,
			ids: ["a", "b"],
			center: { x: 150, y: 50 },
			startAngle: 0,
			snapStep: 0,
		});
		session.update(makePointerEvent({ x: 150, y: 300 }));

		const result = session.commit();
		expect(result).not.toBeNull();
		// commit() reverts to originals; changes only reapply on execute().
		expect(ctx.store.getShape("a")?.rotation ?? 0).toBeCloseTo(0);
		result?.command.execute();
		expect(ctx.store.getShape("a")?.rotation).toBeCloseTo(90);
		result?.command.undo();
		expect(ctx.store.getShape("a")?.rotation ?? 0).toBeCloseTo(0);
		expect(ctx.store.getShape("a")?.x).toBeCloseTo(0);
	});

	it("cancel で元の transform に戻す", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 10, y: 20, width: 40, height: 40, rotation: 5 }));
		ctx.store.setSelection(["a"]);

		const session = startMultiRotateSession({
			ctx,
			ids: ["a"],
			center: { x: 100, y: 100 },
			startAngle: 0,
			snapStep: 0,
		});
		session.update(makePointerEvent({ x: 100, y: 300 }));
		session.cancel();

		const a = ctx.store.getShape("a");
		expect(a?.x).toBeCloseTo(10);
		expect(a?.y).toBeCloseTo(20);
		expect(a?.rotation).toBeCloseTo(5);
	});
});
