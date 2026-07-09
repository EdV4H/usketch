import type { CommandRegistry, EventBus, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it, vi } from "vitest";
import { createBoardStore } from "../board-store.js";
import { createContainmentAttacher } from "../containment-attacher.js";

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
});
