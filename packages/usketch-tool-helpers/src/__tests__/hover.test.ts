import { describe, expect, it } from "vitest";
import { findShapeAtPoint, trackHover } from "../hover.js";
import { createTestToolContext, makePointerEvent, makeShape } from "./test-helpers.js";

describe("findShapeAtPoint", () => {
	it("returns null when no shape is hit", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		expect(findShapeAtPoint(ctx, { x: 200, y: 200 })).toBeNull();
	});

	it("returns the top-most non-container shape", () => {
		const ctx = createTestToolContext();
		// Inserted first → bottom of z-order.
		ctx.store.addShape(makeShape({ id: "bottom", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.addShape(makeShape({ id: "top", x: 0, y: 0, width: 100, height: 100 }));
		expect(findShapeAtPoint(ctx, { x: 50, y: 50 })).toBe("top");
	});

	it("prefers non-container shapes over a container at the same point", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(
			makeShape({ id: "frame", type: "frame", x: 0, y: 0, width: 200, height: 200 }),
		);
		// Non-container drawn after frame, but the precedence rule says non-container wins regardless.
		ctx.store.addShape(
			makeShape({ id: "rect", type: "rect", x: 50, y: 50, width: 50, height: 50 }),
		);
		expect(findShapeAtPoint(ctx, { x: 60, y: 60 })).toBe("rect");
	});
});

describe("trackHover", () => {
	it("returns no cursor override when hovering empty space", () => {
		const ctx = createTestToolContext();
		const result = trackHover(ctx, makePointerEvent({ x: 0, y: 0 }));
		expect(result.cursor).toBe("");
		expect(result.hoveredShapeId).toBeNull();
	});

	it("reports the shape under the cursor as hoveredShapeId", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		const result = trackHover(ctx, makePointerEvent({ x: 50, y: 50 }));
		expect(result.cursor).toBe("");
		expect(result.hoveredShapeId).toBe("a");
	});

	it("respects editingGroupId — only children of that group hit", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "g", type: "group", x: 0, y: 0 }));
		ctx.store.addShape(
			makeShape({ id: "child", x: 0, y: 0, width: 100, height: 100, parentId: "g" }),
		);
		ctx.store.addShape(makeShape({ id: "outsider", x: 50, y: 50, width: 50, height: 50 }));
		const result = trackHover(ctx, makePointerEvent({ x: 60, y: 60 }), {
			editingGroupId: "g",
		});
		expect(result.hoveredShapeId).toBe("child");
	});
});
