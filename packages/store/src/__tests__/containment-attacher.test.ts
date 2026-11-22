import type { CommandRegistry, EventBus, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createBoardStore } from "../board-store.js";
import {
	createContainmentAttacher,
	findAttachParent,
	isInsideForAttach,
} from "../containment-attacher.js";

function makeShape(overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: "s",
		type: "rect",
		x: 0,
		y: 0,
		width: 50,
		height: 50,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...overrides,
	} as ShapeData;
}

/** Minimal command registry that just executes commands (no history needed here). */
function makeCommands(): CommandRegistry {
	return {
		execute: (cmd: { execute(): void }) => cmd.execute(),
		undo() {},
		redo() {},
		canUndo: () => false,
		canRedo: () => false,
		getHistorySize: () => 0,
		getCursor: () => 0,
	} as unknown as CommandRegistry;
}

/** Minimal synchronous event bus. */
function makeEvents(): EventBus {
	const listeners = new Map<string, Set<(p: unknown) => void>>();
	return {
		on(type: string, fn: (p: unknown) => void) {
			const bucket = listeners.get(type) ?? new Set();
			bucket.add(fn);
			listeners.set(type, bucket);
			return () => bucket.delete(fn);
		},
		emit(type: string, payload: unknown) {
			for (const fn of listeners.get(type) ?? []) fn(payload);
		},
		pause() {},
		resume() {},
		isPaused: () => false,
	} as unknown as EventBus;
}

const isFrame = (s: ShapeData) => s.type === "frame";

describe("createContainmentAttacher", () => {
	it("attaches a shape added inside an attach-target container", () => {
		const store = createBoardStore();
		const stop = createContainmentAttacher({
			store,
			commands: makeCommands(),
			events: makeEvents(),
			isAttachTarget: isFrame,
		});

		store.addShape(makeShape({ id: "frame", type: "frame", x: 0, y: 0, width: 400, height: 400 }));
		store.addShape(makeShape({ id: "child", x: 20, y: 20, width: 50, height: 50 }));

		expect(store.getShape("child")?.parentId).toBe("frame");
		stop();
	});

	it("keeps the parentId a shape is added with while that container contains it (Cmd+D / paste over the original)", () => {
		const store = createBoardStore();
		const execute = vi.fn((cmd: { execute(): void }) => cmd.execute());
		const stop = createContainmentAttacher({
			store,
			commands: { ...makeCommands(), execute } as unknown as CommandRegistry,
			events: makeEvents(),
			isAttachTarget: isFrame,
		});

		// Cmd+D / paste can place a frame's copy over the original (e.g. no free spot
		// found). Both same-size frames contain the copied child; re-picking the
		// "smallest" would tie-break to the original (first in the store) and pull
		// the copy's child out of its own frame, behind the copy's opaque background.
		store.addShape(makeShape({ id: "frame", type: "frame", x: 0, y: 0, width: 400, height: 400 }));
		store.addShape(makeShape({ id: "copy", type: "frame", x: 0, y: 0, width: 400, height: 400 }));
		store.addShape(makeShape({ id: "child", parentId: "copy", x: 20, y: 20 }));

		expect(store.getShape("child")?.parentId).toBe("copy");
		expect(execute).not.toHaveBeenCalled();
		stop();
	});

	it("keeps a group parent a shape is added with (duplicating a group keeps its children)", () => {
		const store = createBoardStore();
		const execute = vi.fn((cmd: { execute(): void }) => cmd.execute());
		const stop = createContainmentAttacher({
			store,
			commands: { ...makeCommands(), execute } as unknown as CommandRegistry,
			events: makeEvents(),
			isAttachTarget: isFrame,
		});

		// A group is not an attach target, and its children need not lie inside its
		// stored bounds (they are kept in sync elsewhere); the copy's child must stay
		// in the copied group rather than being detached to the top level.
		store.addShape(makeShape({ id: "frame", type: "frame", x: 0, y: 0, width: 400, height: 400 }));
		store.addShape(makeShape({ id: "group", type: "group", x: 500, y: 0, width: 10, height: 10 }));
		store.addShape(makeShape({ id: "child", parentId: "group", x: 20, y: 20 }));

		expect(store.getShape("child")?.parentId).toBe("group");
		expect(execute).not.toHaveBeenCalled();
		stop();
	});

	it("does not attach a shape added outside any container", () => {
		const store = createBoardStore();
		const stop = createContainmentAttacher({
			store,
			commands: makeCommands(),
			events: makeEvents(),
			isAttachTarget: isFrame,
		});

		store.addShape(makeShape({ id: "frame", type: "frame", x: 0, y: 0, width: 100, height: 100 }));
		store.addShape(makeShape({ id: "child", x: 500, y: 500, width: 50, height: 50 }));

		expect(store.getShape("child")?.parentId).toBeUndefined();
		stop();
	});

	it("does not auto-attach attach-target containers themselves (frames stay top-level)", () => {
		const store = createBoardStore();
		const stop = createContainmentAttacher({
			store,
			commands: makeCommands(),
			events: makeEvents(),
			isAttachTarget: isFrame,
		});

		store.addShape(makeShape({ id: "big", type: "frame", x: 0, y: 0, width: 400, height: 400 }));
		store.addShape(makeShape({ id: "small", type: "frame", x: 20, y: 20, width: 50, height: 50 }));

		expect(store.getShape("small")?.parentId).toBeUndefined();
		stop();
	});

	it("detaches on move-end when the shape leaves its container", () => {
		vi.useFakeTimers();
		const store = createBoardStore();
		const events = makeEvents();
		const stop = createContainmentAttacher({
			store,
			commands: makeCommands(),
			events,
			isAttachTarget: isFrame,
		});

		store.addShape(makeShape({ id: "frame", type: "frame", x: 0, y: 0, width: 200, height: 200 }));
		store.addShape(makeShape({ id: "child", x: 20, y: 20, width: 50, height: 50 }));
		expect(store.getShape("child")?.parentId).toBe("frame");

		// Move the child out and signal move-end.
		store.updateShape("child", { x: 500, y: 500 });
		events.emit("shapes:move-end", { shapeIds: ["child"] });
		vi.runAllTimers();

		expect(store.getShape("child")?.parentId).toBeUndefined();
		stop();
		vi.useRealTimers();
	});

	describe("attachHit / accepts (snug containers such as card slots)", () => {
		const isSlot = (s: ShapeData) => s.type === "slot" || s.type === "frame";
		const centerForSlots = (c: ShapeData) => (c.type === "slot" ? "center" : "contain");

		it("attaches a shape whose center is inside a center-hit container, though it sticks out", () => {
			const store = createBoardStore();
			const stop = createContainmentAttacher({
				store,
				commands: makeCommands(),
				events: makeEvents(),
				isAttachTarget: isSlot,
				attachHit: centerForSlots,
			});

			store.addShape(makeShape({ id: "slot", type: "slot", x: 0, y: 0, width: 100, height: 140 }));
			// 20px off to the bottom-right: not wholly inside, but its center (70, 90) is.
			store.addShape(makeShape({ id: "card", x: 20, y: 20, width: 100, height: 140 }));

			expect(store.getShape("card")?.parentId).toBe("slot");
			stop();
		});

		it("keeps the default (wholly inside) for containers without attachHit", () => {
			const store = createBoardStore();
			const stop = createContainmentAttacher({
				store,
				commands: makeCommands(),
				events: makeEvents(),
				isAttachTarget: isSlot,
			});

			store.addShape(makeShape({ id: "slot", type: "slot", x: 0, y: 0, width: 100, height: 140 }));
			store.addShape(makeShape({ id: "card", x: 20, y: 20, width: 100, height: 140 }));

			expect(store.getShape("card")?.parentId).toBeUndefined();
			stop();
		});

		it("detaches on move-end once the center leaves a center-hit container", () => {
			vi.useFakeTimers();
			const store = createBoardStore();
			const events = makeEvents();
			const stop = createContainmentAttacher({
				store,
				commands: makeCommands(),
				events,
				isAttachTarget: isSlot,
				attachHit: centerForSlots,
			});

			store.addShape(makeShape({ id: "slot", type: "slot", x: 0, y: 0, width: 100, height: 140 }));
			store.addShape(makeShape({ id: "card", x: 10, y: 10, width: 100, height: 140 }));
			expect(store.getShape("card")?.parentId).toBe("slot");

			// Still overlapping, center (40, 50) still inside → stays.
			store.updateShape("card", { x: -10, y: -20 });
			events.emit("shapes:move-end", { shapeIds: ["card"] });
			vi.runAllTimers();
			expect(store.getShape("card")?.parentId).toBe("slot");

			// Center (130, 70) outside → detached.
			store.updateShape("card", { x: 80, y: 0 });
			events.emit("shapes:move-end", { shapeIds: ["card"] });
			vi.runAllTimers();
			expect(store.getShape("card")?.parentId).toBeUndefined();
			stop();
			vi.useRealTimers();
		});

		it("lets a shape the container does not accept pass through to the next container", () => {
			const store = createBoardStore();
			const stop = createContainmentAttacher({
				store,
				commands: makeCommands(),
				events: makeEvents(),
				isAttachTarget: isSlot,
				attachHit: centerForSlots,
				accepts: (container, shape) => container.type !== "slot" || shape.type === "card",
			});

			store.addShape(
				makeShape({ id: "frame", type: "frame", x: -100, y: -100, width: 400, height: 400 }),
			);
			store.addShape(makeShape({ id: "slot", type: "slot", x: 0, y: 0, width: 100, height: 140 }));
			store.addShape(makeShape({ id: "card", type: "card", x: 0, y: 0, width: 100, height: 140 }));
			store.addShape(
				makeShape({ id: "note", type: "sticky", x: 0, y: 0, width: 100, height: 100 }),
			);

			// The smallest container wins for the card; the sticky note skips the slot.
			expect(store.getShape("card")?.parentId).toBe("slot");
			expect(store.getShape("note")?.parentId).toBe("frame");
			stop();
		});

		it("findAttachParent applies the same rules to a not-yet-added copy", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "slot", type: "slot", x: 0, y: 0, width: 100, height: 140 }));
			const copy = makeShape({ id: "copy", type: "card", x: 30, y: 30, width: 100, height: 140 });

			expect(findAttachParent(store, copy, isSlot)).toBeNull();
			expect(findAttachParent(store, copy, isSlot, { attachHit: centerForSlots })?.id).toBe("slot");
			expect(
				findAttachParent(store, copy, isSlot, {
					attachHit: centerForSlots,
					accepts: () => false,
				}),
			).toBeNull();
		});

		it('isInsideForAttach compares wholly by default and by center for "center"', () => {
			const container = makeShape({ id: "c", x: 0, y: 0, width: 100, height: 100 });
			const half = makeShape({ id: "h", x: 40, y: 40, width: 100, height: 100 });
			expect(isInsideForAttach(container, half)).toBe(false);
			expect(isInsideForAttach(container, half, "center")).toBe(true);
			const out = makeShape({ id: "o", x: 60, y: 60, width: 100, height: 100 });
			expect(isInsideForAttach(container, out, "center")).toBe(false);
		});
	});
});
