import type { ResizeHandle, ShapeData } from "@edv4h/usketch-shared";
import { rotatePoint } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { computeRawBounds } from "../internal/resize-handles.js";
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

function mustGet(ctx: ReturnType<typeof createTestToolContext>, id: string): ShapeData {
	const shape = ctx.store.getShape(id);
	if (!shape) throw new Error(`shape ${id} not found`);
	return shape;
}

describe("startResizeSession (single, rotated)", () => {
	/** World position of a point given as fractions of the shape's local box. */
	function worldAt(shape: ShapeData, fx: number, fy: number) {
		const center = { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
		return rotatePoint(
			{ x: shape.x + fx * shape.width, y: shape.y + fy * shape.height },
			center,
			((shape.rotation ?? 0) * Math.PI) / 180,
		);
	}

	for (const rotation of [30, 90, 200]) {
		it(`keeps the corner opposite the SE handle fixed on screen at ${rotation}°`, () => {
			const ctx = createTestToolContext();
			ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 200, height: 120, rotation }));
			const start = mustGet(ctx, "a");
			const nw = worldAt(start, 0, 0);
			const se = worldAt(start, 1, 1);
			const session = startResizeSession({
				kind: "single",
				ctx,
				shapeId: "a",
				handle: "se",
				startPoint: se,
			});
			// Drag the handle 40 further along the shape's own x axis and 30 along its y axis.
			const rad = (rotation * Math.PI) / 180;
			const ux = { x: Math.cos(rad), y: Math.sin(rad) };
			const uy = { x: -Math.sin(rad), y: Math.cos(rad) };
			session.update(
				makePointerEvent({ x: se.x + 40 * ux.x + 30 * uy.x, y: se.y + 40 * ux.y + 30 * uy.y }),
			);
			const after = mustGet(ctx, "a");
			expect(after.width).toBeCloseTo(240);
			expect(after.height).toBeCloseTo(150);
			expect(worldAt(after, 0, 0).x).toBeCloseTo(nw.x);
			expect(worldAt(after, 0, 0).y).toBeCloseTo(nw.y);
			// The dragged corner follows the pointer.
			expect(worldAt(after, 1, 1).x).toBeCloseTo(se.x + 40 * ux.x + 30 * uy.x);
			expect(worldAt(after, 1, 1).y).toBeCloseTo(se.y + 40 * ux.y + 30 * uy.y);
		});
	}

	it("keeps the opposite edge fixed for an edge handle, and across a flip", () => {
		const ctx = createTestToolContext();
		const rect = ctx.shapes.get("rect");
		if (!rect) throw new Error("rect shape is not registered");
		// A handle-aware resize (the default test rect only grows to the SE).
		ctx.shapes.register("box", {
			...rect,
			resize: (data: ShapeData, handle: ResizeHandle, delta: { x: number; y: number }) => ({
				...data,
				...computeRawBounds(data, handle, delta),
			}),
		});
		ctx.store.addShape(
			makeShape({ id: "a", type: "box", x: 0, y: 0, width: 200, height: 100, rotation: 90 }),
		);
		const start = mustGet(ctx, "a");
		const west = worldAt(start, 0, 0.5); // (100, -50) rotated: the anchor of the E handle
		const east = worldAt(start, 1, 0.5);
		const session = startResizeSession({
			kind: "single",
			ctx,
			shapeId: "a",
			handle: "e",
			startPoint: east,
		});
		// At 90° the local x axis points down the screen: pull the E handle up past the W edge.
		session.update(makePointerEvent({ x: east.x, y: west.y - 1 }));
		session.update(makePointerEvent({ x: east.x, y: west.y - 100 }));
		const after = mustGet(ctx, "a");
		// The flip restarts from the crossing point (1 past the edge), as unrotated.
		expect(after.width).toBeCloseTo(99);
		// The flipped box hangs off the old W edge, on the same line (no sideways jump).
		const ends = [worldAt(after, 0, 0.5), worldAt(after, 1, 0.5)];
		for (const p of ends) expect(p.x).toBeCloseTo(west.x);
		const ys = ends.map((p) => p.y).sort((a, b) => a - b);
		expect(ys[0]).toBeCloseTo(west.y - 99);
		expect(ys[1]).toBeCloseTo(west.y);
	});

	it("undo restores the rotated shape's original box", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100, rotation: 45 }));
		const se = worldAt(mustGet(ctx, "a"), 1, 1);
		const session = startResizeSession({
			kind: "single",
			ctx,
			shapeId: "a",
			handle: "se",
			startPoint: se,
		});
		session.update(makePointerEvent({ x: se.x + 30, y: se.y + 30 }));
		const moved = { ...mustGet(ctx, "a") };
		const result = session.commit();
		if (!result) throw new Error("expected a command");
		ctx.commands.execute(result.command);
		expect(ctx.store.getShape("a")).toMatchObject({ x: moved.x, y: moved.y, width: moved.width });
		ctx.commands.undo();
		expect(ctx.store.getShape("a")).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
	});
});
