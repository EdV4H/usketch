import type { ShapeDefinition } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { boxContains, boxesIntersect, startMarqueeSession } from "../marquee.js";
import { createTestToolContext, makePointerEvent, makeShape } from "./test-helpers.js";

describe("startMarqueeSession", () => {
	it("intersect mode picks shapes that overlap the rect at all", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		ctx.store.addShape(makeShape({ id: "b", x: 200, y: 0, width: 100, height: 100 }));
		const session = startMarqueeSession({
			ctx,
			startWorldPoint: { x: 50, y: 50 },
		});
		const u = session.update(makePointerEvent({ x: 250, y: 80 }));
		expect(u.mode).toBe("intersect");
		expect([...u.hitIds].sort()).toEqual(["a", "b"]);
	});

	it("contain mode (alt) requires the rect to fully enclose the shape", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "small", x: 50, y: 50, width: 20, height: 20 }));
		ctx.store.addShape(makeShape({ id: "big", x: 0, y: 0, width: 200, height: 200 }));
		const session = startMarqueeSession({
			ctx,
			startWorldPoint: { x: 0, y: 0 },
		});
		const u = session.update(makePointerEvent({ x: 100, y: 100 }, { altKey: true }));
		expect(u.mode).toBe("contain");
		// `small` is inside [0..100]² but `big` (0..200) extends outside.
		expect([...u.hitIds]).toEqual(["small"]);
	});

	it("excludes hidden and locked shapes from the selection", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "normal", x: 0, y: 0, width: 50, height: 50 }));
		ctx.store.addShape(
			makeShape({ id: "hidden", x: 0, y: 0, width: 50, height: 50, hidden: true }),
		);
		ctx.store.addShape(
			makeShape({ id: "locked", x: 0, y: 0, width: 50, height: 50, locked: true }),
		);
		const session = startMarqueeSession({ ctx, startWorldPoint: { x: -10, y: -10 } });
		const u = session.update(makePointerEvent({ x: 100, y: 100 }));
		expect([...u.hitIds]).toEqual(["normal"]);
	});

	it("selects an attachable child individually, not its parent", () => {
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
		ctx.store.addShape(
			makeShape({ id: "note", type: "rect", x: 0, y: 0, width: 100, height: 100 }),
		);
		ctx.store.addShape(
			makeShape({
				id: "sticker",
				type: "sticker",
				x: 10,
				y: 10,
				width: 30,
				height: 30,
				parentId: "note",
			}),
		);
		const session = startMarqueeSession({ ctx, startWorldPoint: { x: 5, y: 5 } });
		const u = session.update(makePointerEvent({ x: 60, y: 60 }));
		// The sticker resolves to itself (attachable), not to its "note" parent.
		expect(u.hitIds.has("sticker")).toBe(true);
	});

	it("commit() returns null for tiny accidental drags below minDragDistance", () => {
		const ctx = createTestToolContext();
		ctx.store.addShape(makeShape({ id: "a", x: 0, y: 0, width: 100, height: 100 }));
		const session = startMarqueeSession({
			ctx,
			startWorldPoint: { x: 0, y: 0 },
			minDragDistance: 2,
		});
		// 1px drag — under the 2px noise floor.
		session.update(makePointerEvent({ x: 1, y: 1 }));
		expect(session.commit()).toBeNull();
	});
});

describe("box predicates", () => {
	it("boxesIntersect detects partial overlap", () => {
		expect(
			boxesIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 }),
		).toBe(true);
		expect(
			boxesIntersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 0, width: 10, height: 10 }),
		).toBe(false);
	});

	it("boxContains requires full enclosure", () => {
		expect(
			boxContains({ x: 0, y: 0, width: 100, height: 100 }, { x: 10, y: 10, width: 50, height: 50 }),
		).toBe(true);
		expect(
			boxContains(
				{ x: 0, y: 0, width: 100, height: 100 },
				{ x: 50, y: 50, width: 100, height: 100 },
			),
		).toBe(false);
	});
});
