import type { CommandRegistry, EventBus, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { type AttachableResolution, createAttachableAttacher } from "../attachable-attacher.js";
import { createBoardStore } from "../board-store.js";

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

/**
 * Resolve `sticker` shapes as attachable children. Mirrors the plugin's wiring:
 * exclude self and connectors, then apply an optional target filter.
 */
function stickerResolve(
	hitTest: "center" | "contain",
	accepts: (target: ShapeData) => boolean = () => true,
): (shape: ShapeData) => AttachableResolution | null {
	return (shape) => {
		if (shape.type !== "sticker") return null;
		return {
			accepts: (t) => t.id !== shape.id && t.type !== "connector" && accepts(t),
			hitTest,
		};
	};
}

describe("createAttachableAttacher", () => {
	it("attaches a sticker to the shape under its center on move-end (center hit)", () => {
		vi.useFakeTimers();
		const store = createBoardStore();
		const events = makeEvents();
		const stop = createAttachableAttacher({
			store,
			commands: makeCommands(),
			events,
			resolve: stickerResolve("center"),
		});

		store.addShape(makeShape({ id: "note", type: "note", x: 0, y: 0, width: 200, height: 200 }));
		// Sticker's center (110,110) sits inside the note even though the sticker is
		// not fully contained.
		store.addShape(
			makeShape({ id: "sticker", type: "sticker", x: 90, y: 90, width: 40, height: 40 }),
		);

		events.emit("shapes:move-end", { shapeIds: ["sticker"] });
		vi.runAllTimers();

		expect(store.getShape("sticker")?.parentId).toBe("note");
		stop();
		vi.useRealTimers();
	});

	it("detaches when the sticker's center leaves the target", () => {
		vi.useFakeTimers();
		const store = createBoardStore();
		const events = makeEvents();
		const stop = createAttachableAttacher({
			store,
			commands: makeCommands(),
			events,
			resolve: stickerResolve("center"),
		});

		store.addShape(makeShape({ id: "note", type: "note", x: 0, y: 0, width: 200, height: 200 }));
		store.addShape(
			makeShape({ id: "sticker", type: "sticker", x: 90, y: 90, width: 40, height: 40 }),
		);
		events.emit("shapes:move-end", { shapeIds: ["sticker"] });
		vi.runAllTimers();
		expect(store.getShape("sticker")?.parentId).toBe("note");

		store.updateShape("sticker", { x: 500, y: 500 });
		events.emit("shapes:move-end", { shapeIds: ["sticker"] });
		vi.runAllTimers();

		expect(store.getShape("sticker")?.parentId).toBeUndefined();
		stop();
		vi.useRealTimers();
	});

	it("does not attach a non-attachable shape (resolve returns null)", () => {
		vi.useFakeTimers();
		const store = createBoardStore();
		const events = makeEvents();
		const stop = createAttachableAttacher({
			store,
			commands: makeCommands(),
			events,
			resolve: stickerResolve("center"),
		});

		store.addShape(makeShape({ id: "note", type: "note", x: 0, y: 0, width: 200, height: 200 }));
		// A plain rect, not a sticker.
		store.addShape(makeShape({ id: "rect", type: "rect", x: 90, y: 90, width: 40, height: 40 }));
		events.emit("shapes:move-end", { shapeIds: ["rect"] });
		vi.runAllTimers();

		expect(store.getShape("rect")?.parentId).toBeUndefined();
		stop();
		vi.useRealTimers();
	});

	it("honors the toAny filter — skips excluded target types", () => {
		vi.useFakeTimers();
		const store = createBoardStore();
		const events = makeEvents();
		const stop = createAttachableAttacher({
			store,
			commands: makeCommands(),
			events,
			// Only stick to `note`, never to `connector`.
			resolve: stickerResolve("center", (t) => t.type === "note"),
		});

		store.addShape(
			makeShape({ id: "conn", type: "connector", x: 0, y: 0, width: 200, height: 200 }),
		);
		store.addShape({
			...makeShape({ id: "sticker", type: "sticker", x: 90, y: 90, width: 40, height: 40 }),
		});
		events.emit("shapes:move-end", { shapeIds: ["sticker"] });
		vi.runAllTimers();

		expect(store.getShape("sticker")?.parentId).toBeUndefined();
		stop();
		vi.useRealTimers();
	});

	it("picks the front-most accepted target when several overlap", () => {
		vi.useFakeTimers();
		const store = createBoardStore();
		const events = makeEvents();
		const stop = createAttachableAttacher({
			store,
			commands: makeCommands(),
			events,
			resolve: stickerResolve("center"),
		});

		// Added later → higher zIndex → front-most.
		store.addShape(makeShape({ id: "back", type: "note", x: 0, y: 0, width: 200, height: 200 }));
		store.addShape(makeShape({ id: "front", type: "note", x: 0, y: 0, width: 200, height: 200 }));
		store.addShape(
			makeShape({ id: "sticker", type: "sticker", x: 90, y: 90, width: 40, height: 40 }),
		);
		events.emit("shapes:move-end", { shapeIds: ["sticker"] });
		vi.runAllTimers();

		expect(store.getShape("sticker")?.parentId).toBe("front");
		stop();
		vi.useRealTimers();
	});

	it("contain mode requires full containment, not just center overlap", () => {
		vi.useFakeTimers();
		const store = createBoardStore();
		const events = makeEvents();
		const stop = createAttachableAttacher({
			store,
			commands: makeCommands(),
			events,
			resolve: stickerResolve("contain"),
		});

		store.addShape(makeShape({ id: "note", type: "note", x: 0, y: 0, width: 100, height: 100 }));
		// Center (110,110) is outside; and it isn't fully contained either.
		store.addShape(
			makeShape({ id: "sticker", type: "sticker", x: 90, y: 90, width: 40, height: 40 }),
		);
		events.emit("shapes:move-end", { shapeIds: ["sticker"] });
		vi.runAllTimers();
		expect(store.getShape("sticker")?.parentId).toBeUndefined();

		// Now fully inside → attaches.
		store.updateShape("sticker", { x: 20, y: 20 });
		events.emit("shapes:move-end", { shapeIds: ["sticker"] });
		vi.runAllTimers();
		expect(store.getShape("sticker")?.parentId).toBe("note");
		stop();
		vi.useRealTimers();
	});
});
