import type { ShapeDefinition, ToolContext } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { startDragSession } from "../drag.js";
import {
	createTestCommands,
	createTestEventBus,
	createTestShapeRegistry,
	createTestStore,
	createTestToolContext,
	makePointerEvent,
	makeShape,
} from "./test-helpers.js";

/** Tool context whose registry adds a `sticker` type declaring `attachable.follow`. */
function createAttachableToolContext(): ToolContext {
	const overrides = new Map<string, ShapeDefinition>([
		["sticker", { type: "sticker", attachable: { follow: true } } as unknown as ShapeDefinition],
	]);
	return {
		store: createTestStore(),
		shapes: createTestShapeRegistry(overrides),
		commands: createTestCommands(),
		events: createTestEventBus(),
	};
}

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

	it("does NOT follow children of a non-container parent by default", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "card", type: "card", x: 0, y: 0 }));
		ctx.store.addShape(makeShape({ id: "sticker", x: 10, y: 10, parentId: "card" }));

		const session = startDragSession({ ctx, startPoint: { x: 0, y: 0 }, shapeIds: ["card"] });
		session.update(makePointerEvent({ x: 30, y: 0 }));
		expect(ctx.store.getShape("card")?.x).toBe(30);
		// Default: ordinary parent's child stays put.
		expect(ctx.store.getShape("sticker")?.x).toBe(10);
	});

	it("follows children of a non-container parent when followChildrenOf opts in", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "card", type: "card", x: 0, y: 0 }));
		ctx.store.addShape(makeShape({ id: "sticker", x: 10, y: 10, parentId: "card" }));

		const session = startDragSession({
			ctx,
			startPoint: { x: 0, y: 0 },
			shapeIds: ["card"],
			followChildrenOf: () => true,
		});
		session.update(makePointerEvent({ x: 30, y: 0 }));
		expect(ctx.store.getShape("card")?.x).toBe(30);
		// Opted in: the attached sticker follows by the parent's delta.
		expect(ctx.store.getShape("sticker")?.x).toBe(40);
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
		ctx.commands.execute(result?.command);
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

	it("exposes movingShapeIds including descendants so callers can exclude them from drop-target tests", () => {
		// Regression for the "container drop-target on its own child" bug:
		// dragging a group should expose the group + all descendants so the
		// caller (tool-select's drop-target hit test) can skip them entirely.
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "g", type: "group", x: 0, y: 0 }));
		ctx.store.addShape(makeShape({ id: "child", x: 10, y: 10, parentId: "g" }));
		ctx.store.addShape(makeShape({ id: "innerFrame", type: "frame", x: 20, y: 20, parentId: "g" }));
		const session = startDragSession({
			ctx,
			startPoint: { x: 0, y: 0 },
			shapeIds: ["g"],
		});
		expect([...session.movingShapeIds].sort()).toEqual(["child", "g", "innerFrame"]);
	});

	it("follows an attachable.follow child of a non-container parent (child-side opt-in)", () => {
		const ctx = createAttachableToolContext();
		// `card` is not registered → non-container parent.
		ctx.store.addShape(makeShape({ id: "card", type: "card", x: 0, y: 0 }));
		ctx.store.addShape(
			makeShape({ id: "sticker", type: "sticker", x: 10, y: 10, parentId: "card" }),
		);

		const session = startDragSession({ ctx, startPoint: { x: 0, y: 0 }, shapeIds: ["card"] });
		session.update(makePointerEvent({ x: 30, y: 0 }));
		expect(ctx.store.getShape("card")?.x).toBe(30);
		// No plugin, no followChildrenOf: the child follows purely from its own flag.
		expect(ctx.store.getShape("sticker")?.x).toBe(40);
		expect([...session.movingShapeIds].sort()).toEqual(["card", "sticker"]);
	});

	it("does NOT follow a non-attachable sibling under the same non-container parent", () => {
		const ctx = createAttachableToolContext();
		ctx.store.addShape(makeShape({ id: "card", type: "card", x: 0, y: 0 }));
		ctx.store.addShape(
			makeShape({ id: "sticker", type: "sticker", x: 10, y: 10, parentId: "card" }),
		);
		// A plain rect child (no attachable) attached to the same non-container parent.
		ctx.store.addShape(makeShape({ id: "plain", type: "rect", x: 20, y: 20, parentId: "card" }));

		const session = startDragSession({ ctx, startPoint: { x: 0, y: 0 }, shapeIds: ["card"] });
		session.update(makePointerEvent({ x: 30, y: 0 }));
		expect(ctx.store.getShape("sticker")?.x).toBe(40);
		// The non-attachable sibling stays put.
		expect(ctx.store.getShape("plain")?.x).toBe(20);
		expect([...session.movingShapeIds].sort()).toEqual(["card", "sticker"]);
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
