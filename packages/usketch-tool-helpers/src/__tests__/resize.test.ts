import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { startResizeSession, toLocalFlipAxes } from "../resize.js";
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

describe("startResizeSession — ShapeDefinition.flip hook", () => {
	function ctxWithFlipShape(calls: Array<{ x: boolean; y: boolean }>) {
		const ctx = createTestToolContext();
		const rect = ctx.shapes.get("rect");
		if (!rect) throw new Error("rect shape is not registered");
		ctx.shapes.register("flippy", {
			...rect,
			flip: (data: ShapeData, axes: { x: boolean; y: boolean }) => {
				calls.push(axes);
				return { "x-flips": ((data["x-flips"] as number | undefined) ?? 0) + 1 };
			},
		});
		return ctx;
	}

	it("single: calls flip with the crossed axis and applies its patch", () => {
		const calls: Array<{ x: boolean; y: boolean }> = [];
		const ctx = ctxWithFlipShape(calls);
		ctx.store.addShape(makeShape({ id: "a", type: "flippy", x: 0, y: 0, width: 100, height: 50 }));
		const session = startResizeSession({
			kind: "single",
			ctx,
			shapeId: "a",
			handle: "e",
			startPoint: { x: 100, y: 25 },
		});
		// Drag the east handle past the west edge.
		session.update(makePointerEvent({ x: -20, y: 25 }));
		expect(calls).toEqual([{ x: true, y: false }]);
		expect(ctx.store.getShape("a")?.["x-flips"]).toBe(1);
		// Continued drag must keep the flipped field (not reset from stale startData).
		session.update(makePointerEvent({ x: -40, y: 25 }));
		expect(ctx.store.getShape("a")?.["x-flips"]).toBe(1);
		// The flip is part of the committed command.
		const result = session.commit();
		expect(ctx.store.getShape("a")?.["x-flips"]).toBeUndefined();
		if (!result) throw new Error("expected a commit");
		ctx.commands.execute(result.command);
		expect(ctx.store.getShape("a")?.["x-flips"]).toBe(1);
	});

	it("multi: calls flip for each shape whose definition has the hook", () => {
		const calls: Array<{ x: boolean; y: boolean }> = [];
		const ctx = ctxWithFlipShape(calls);
		ctx.store.addShape(makeShape({ id: "a", type: "flippy", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.addShape(makeShape({ id: "b", x: 200, y: 0, width: 100, height: 100 }));
		const session = startResizeSession({
			kind: "multi",
			ctx,
			selection: new Set(["a", "b"]),
			handle: "s",
			startPoint: { x: 150, y: 100 },
			groupBounds: { x: 0, y: 0, width: 300, height: 100 },
		});
		session.update(makePointerEvent({ x: 150, y: -50 }));
		expect(calls).toEqual([{ x: false, y: true }]);
		expect(ctx.store.getShape("a")?.["x-flips"]).toBe(1);
		expect(ctx.store.getShape("b")?.["x-flips"]).toBeUndefined();
	});

	it("multi: passes the flip in the shape's local axes when it is rotated ~90°", () => {
		const calls: Array<{ x: boolean; y: boolean }> = [];
		const ctx = ctxWithFlipShape(calls);
		ctx.store.addShape(
			makeShape({ id: "a", type: "flippy", x: 0, y: 0, width: 100, height: 100, rotation: 90 }),
		);
		ctx.store.addShape(makeShape({ id: "b", x: 200, y: 0, width: 100, height: 100 }));
		const session = startResizeSession({
			kind: "multi",
			ctx,
			selection: new Set(["a", "b"]),
			handle: "s",
			startPoint: { x: 150, y: 100 },
			groupBounds: { x: 0, y: 0, width: 300, height: 100 },
		});
		// A vertical (world y) flip is along the rotated shape's local x axis.
		session.update(makePointerEvent({ x: 150, y: -50 }));
		expect(calls).toEqual([{ x: true, y: false }]);
	});

	it("cancel clears fields that flip added", () => {
		for (const kind of ["single", "multi"] as const) {
			const ctx = ctxWithFlipShape([]);
			ctx.store.addShape(
				makeShape({ id: "a", type: "flippy", x: 0, y: 0, width: 100, height: 50 }),
			);
			const session =
				kind === "single"
					? startResizeSession({
							kind,
							ctx,
							shapeId: "a",
							handle: "e",
							startPoint: { x: 100, y: 25 },
						})
					: startResizeSession({
							kind,
							ctx,
							selection: new Set(["a"]),
							handle: "e",
							startPoint: { x: 100, y: 25 },
							groupBounds: { x: 0, y: 0, width: 100, height: 50 },
						});
			session.update(makePointerEvent({ x: -20, y: 25 }));
			expect(ctx.store.getShape("a")?.["x-flips"]).toBe(1);
			session.cancel();
			expect(ctx.store.getShape("a")?.["x-flips"]).toBeUndefined();
			expect(ctx.store.getShape("a")).toMatchObject({ x: 0, width: 100 });
		}
	});
});

describe("toLocalFlipAxes", () => {
	it("keeps the axes near 0° / 180° and swaps them near 90° / 270°", () => {
		const axes = { x: true, y: false };
		expect(toLocalFlipAxes(axes, undefined)).toEqual(axes);
		expect(toLocalFlipAxes(axes, 170)).toEqual(axes);
		expect(toLocalFlipAxes(axes, 90)).toEqual({ x: false, y: true });
		expect(toLocalFlipAxes(axes, -100)).toEqual({ x: false, y: true });
	});
});
