import type { ShapeDefinition } from "@edv4h/usketch-shared";
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

	it("skips a hidden top shape and returns the one beneath it", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "bottom", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.addShape(makeShape({ id: "top", x: 0, y: 0, width: 100, height: 100, hidden: true }));
		expect(findShapeAtPoint(ctx, { x: 50, y: 50 })).toBe("bottom");
	});

	it("skips a locked shape (not interactive)", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(
			makeShape({ id: "only", x: 0, y: 0, width: 100, height: 100, locked: true }),
		);
		expect(findShapeAtPoint(ctx, { x: 50, y: 50 })).toBeNull();
	});

	it("skips a child under a hidden ancestor (cascade)", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(
			makeShape({ id: "frame", type: "frame", x: 0, y: 0, width: 200, height: 200, hidden: true }),
		);
		ctx.store.addShape(
			makeShape({
				id: "child",
				type: "rect",
				parentId: "frame",
				x: 50,
				y: 50,
				width: 50,
				height: 50,
			}),
		);
		expect(findShapeAtPoint(ctx, { x: 60, y: 60 })).toBeNull();
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

	it("skips excluded ids and returns the shape below (drag-and-drop)", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "target", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.addShape(makeShape({ id: "dragged", x: 0, y: 0, width: 100, height: 100 }));
		// Without exclusion the top-most (dragged) wins.
		expect(findShapeAtPoint(ctx, { x: 50, y: 50 })).toBe("dragged");
		// Excluding the dragged id returns the shape beneath it (array or Set).
		expect(findShapeAtPoint(ctx, { x: 50, y: 50 }, { excludeIds: ["dragged"] })).toBe("target");
		expect(findShapeAtPoint(ctx, { x: 50, y: 50 }, { excludeIds: new Set(["dragged"]) })).toBe(
			"target",
		);
	});

	it("skips shapes rejected by the filter predicate", () => {
		const ctx = createTestToolContext();
		// Register a hit-testable "sticker" def so the shape actually passes
		// hitTest — otherwise it would be skipped for a missing def and the test
		// wouldn't exercise the filter at all.
		ctx.shapes.register("sticker", {
			type: "sticker",
			minSize: { width: 1, height: 1 },
			hitTest: (data, point) =>
				point.x >= data.x &&
				point.x <= data.x + data.width &&
				point.y >= data.y &&
				point.y <= data.y + data.height,
			getBounds: (data) => ({ x: data.x, y: data.y, width: data.width, height: data.height }),
			render: () => null,
		} as unknown as ShapeDefinition);
		ctx.store.addShape(
			makeShape({ id: "target", type: "rect", x: 0, y: 0, width: 100, height: 100 }),
		);
		ctx.store.addShape(
			makeShape({ id: "sticker", type: "sticker", x: 0, y: 0, width: 100, height: 100 }),
		);
		// Without the filter the top-most (sticker) wins — proves it is hit-tested.
		expect(findShapeAtPoint(ctx, { x: 50, y: 50 })).toBe("sticker");
		// Skip our own "sticker" type so the drop resolves to the rect underneath.
		expect(findShapeAtPoint(ctx, { x: 50, y: 50 }, { filter: (s) => s.type !== "sticker" })).toBe(
			"target",
		);
	});

	it("resolves a frame child to the child itself (selectableChildren)", () => {
		// frame/island are containers with selectableChildren → clicking a child
		// selects the child directly, not the container.
		const ctx = createTestToolContext();
		ctx.store.addShape(
			makeShape({ id: "frame", type: "frame", x: 0, y: 0, width: 200, height: 200 }),
		);
		ctx.store.addShape(
			makeShape({ id: "child", x: 10, y: 10, width: 50, height: 50, parentId: "frame" }),
		);
		expect(findShapeAtPoint(ctx, { x: 20, y: 20 })).toBe("child");
	});

	it("resolves a group child to the group ancestor (no selectableChildren)", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "g", type: "group", x: 0, y: 0, width: 200, height: 200 }));
		ctx.store.addShape(
			makeShape({ id: "child", x: 10, y: 10, width: 50, height: 50, parentId: "g" }),
		);
		expect(findShapeAtPoint(ctx, { x: 20, y: 20 })).toBe("g");
	});

	it("keeps an attachable child selectable under a non-container parent", () => {
		// Stickers/kimochi attach by overlap (attachable) but must stay
		// independently selectable so they can be peeled off — unlike group
		// members, they do NOT resolve to the parent.
		const ctx = createTestToolContext();
		ctx.shapes.register("sticker", {
			type: "sticker",
			minSize: { width: 1, height: 1 },
			hitTest: (data, point) =>
				point.x >= data.x &&
				point.x <= data.x + data.width &&
				point.y >= data.y &&
				point.y <= data.y + data.height,
			getBounds: (data) => ({ x: data.x, y: data.y, width: data.width, height: data.height }),
			render: () => null,
			attachable: { follow: true },
		} as unknown as ShapeDefinition);
		// Parent is a plain rect (a non-container the sticker was stuck onto).
		ctx.store.addShape(
			makeShape({ id: "note", type: "rect", x: 0, y: 0, width: 200, height: 200 }),
		);
		ctx.store.addShape(
			makeShape({
				id: "sticker",
				type: "sticker",
				x: 10,
				y: 10,
				width: 50,
				height: 50,
				parentId: "note",
			}),
		);
		expect(findShapeAtPoint(ctx, { x: 20, y: 20 })).toBe("sticker");
	});

	it("honors a per-instance selectableChildren predicate on a custom type", () => {
		// A single "wireframe" type whose meta.component === "card" is a container
		// with selectable children; other components are plain shapes.
		const ctx = createTestToolContext();
		ctx.shapes.register("wireframe", {
			type: "wireframe",
			minSize: { width: 1, height: 1 },
			hitTest: (data: ShapeDefinition & ShapeData, point: { x: number; y: number }) =>
				point.x >= (data as ShapeData).x &&
				point.x <= (data as ShapeData).x + (data as ShapeData).width &&
				point.y >= (data as ShapeData).y &&
				point.y <= (data as ShapeData).y + (data as ShapeData).height,
			getBounds: (data: ShapeData) => ({
				x: data.x,
				y: data.y,
				width: data.width,
				height: data.height,
			}),
			render: () => null,
			container: {
				enabled: (s: ShapeData) => s.meta?.component === "card",
				selectableChildren: (s: ShapeData) => s.meta?.component === "card",
			},
		} as unknown as ShapeDefinition);

		ctx.store.addShape(
			makeShape({
				id: "card",
				type: "wireframe",
				x: 0,
				y: 0,
				width: 200,
				height: 200,
				meta: { component: "card" },
			}),
		);
		ctx.store.addShape(
			makeShape({
				id: "btn",
				type: "wireframe",
				x: 10,
				y: 10,
				width: 50,
				height: 50,
				parentId: "card",
				meta: { component: "button" },
			}),
		);
		expect(findShapeAtPoint(ctx, { x: 20, y: 20 })).toBe("btn");
	});

	it("applies excludeIds/filter to the resolved group ancestor, not just the hit child", () => {
		// A group child hit resolves to its top-level group ancestor. Excluding or
		// filtering out that ancestor must continue the walk to the shape below,
		// not return the gated ancestor. Regression for the ancestor-gating fix.
		const ctx = createTestToolContext();
		// Bottom shape, then the group, then its child (top of z-order).
		ctx.store.addShape(makeShape({ id: "below", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.addShape(makeShape({ id: "g", type: "group", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.addShape(
			makeShape({ id: "child", x: 0, y: 0, width: 100, height: 100, parentId: "g" }),
		);

		// Default: hitting the child resolves to the group ancestor.
		expect(findShapeAtPoint(ctx, { x: 50, y: 50 })).toBe("g");
		// Excluding the resolved ancestor falls through to the shape below.
		expect(findShapeAtPoint(ctx, { x: 50, y: 50 }, { excludeIds: ["g"] })).toBe("below");
		// Filtering the resolved ancestor does the same.
		expect(findShapeAtPoint(ctx, { x: 50, y: 50 }, { filter: (s) => s.id !== "g" })).toBe("below");
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
