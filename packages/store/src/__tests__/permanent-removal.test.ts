import {
	applyExternal,
	createRestoreCommand,
	isPermanentlyRemoved,
	removeShapePermanently,
	type ShapeData,
	type StoreEvent,
} from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createBoardStore } from "../board-store.js";
import { createDeleteShapeCommand, createMoveShapesCommand } from "../commands.js";

function makeShape(id: string, type = "rectangle"): ShapeData {
	return {
		id,
		type,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	};
}

function recordEvents(store: ReturnType<typeof createBoardStore>): StoreEvent[] {
	const events: StoreEvent[] = [];
	store.onMutation((event) => events.push(event));
	return events;
}

describe("BoardStore permanent removal", () => {
	it("removes the shape, records the id and fires a permanent shape:removed with the shape", () => {
		const store = createBoardStore();
		store.addShape(makeShape("skewer", "skewer"));
		const before = store.getShape("skewer");
		const events = recordEvents(store);

		expect(removeShapePermanently(store, "skewer")).toBe(true);

		expect(store.getShape("skewer")).toBeUndefined();
		expect(isPermanentlyRemoved(store, "skewer")).toBe(true);
		expect([...(store.getPermanentlyRemovedIds?.() ?? [])]).toEqual(["skewer"]);
		const removed = events.filter((e) => e.type === "shape:removed");
		expect(removed).toEqual([
			{
				type: "shape:removed",
				payload: { id: "skewer", ids: ["skewer"], permanent: true, shape: before },
			},
		]);
	});

	it("returns false the second time and fires nothing", () => {
		const store = createBoardStore();
		store.addShape(makeShape("a"));
		removeShapePermanently(store, "a");
		const events = recordEvents(store);
		expect(removeShapePermanently(store, "a")).toBe(false);
		expect(events).toEqual([]);
	});

	it("leaves a shape of another type alone with expectedType, every time", () => {
		const store = createBoardStore();
		store.addShape(makeShape("a", "rectangle"));
		const events = recordEvents(store);

		expect(removeShapePermanently(store, "a", { expectedType: "skewer" })).toBe(false);
		expect(removeShapePermanently(store, "a", { expectedType: "skewer" })).toBe(false);

		expect(store.getShape("a")).toBeDefined();
		expect(isPermanentlyRemoved(store, "a")).toBe(false);
		expect(events).toEqual([]);
		expect(removeShapePermanently(store, "a", { expectedType: "rectangle" })).toBe(true);
	});

	it("records an id that isn't on the board yet, and blocks it from being added later", () => {
		const store = createBoardStore();
		const events = recordEvents(store);
		expect(removeShapePermanently(store, "later")).toBe(true);
		// A local record still fires (no shape), so sync can share it.
		expect(events).toEqual([
			{ type: "shape:removed", payload: { id: "later", ids: ["later"], permanent: true } },
		]);
		store.addShape(makeShape("later"));
		expect(store.getShape("later")).toBeUndefined();
	});

	it("fires nothing for a record arriving through sync for a shape it never had", () => {
		const store = createBoardStore();
		const events = recordEvents(store);
		applyExternal(store, () => removeShapePermanently(store, "remote"));
		expect(isPermanentlyRemoved(store, "remote")).toBe(true);
		expect(events).toEqual([]);
	});

	it("is not added to undo, and undoing an earlier delete or move doesn't bring it back", () => {
		const store = createBoardStore();
		store.addShape(makeShape("a"));
		store.addShape(makeShape("b"));

		const del = createDeleteShapeCommand(store, "a");
		del.execute();
		const moveBefore = new Map([["b", store.getShape("b") as ShapeData]]);
		const moveAfter = new Map([["b", { ...(store.getShape("b") as ShapeData), x: 50 }]]);
		const move = createMoveShapesCommand(store, moveBefore, moveAfter);
		move.execute();

		removeShapePermanently(store, "a");
		removeShapePermanently(store, "b");

		del.undo();
		move.undo();
		store.updateShape("b", { x: 10 });
		expect(store.getShape("a")).toBeUndefined();
		expect(store.getShape("b")).toBeUndefined();
	});

	it("isn't brought back by restoring an old version", () => {
		const store = createBoardStore();
		store.addShape(makeShape("a"));
		store.addShape(makeShape("keep"));
		const version = [...store.getShapes().values()];
		removeShapePermanently(store, "a");
		store.deleteShape("keep");

		createRestoreCommand(store, version).execute();

		expect(store.getShape("a")).toBeUndefined();
		expect(store.getShape("keep")).toBeDefined();
	});

	it("blocks writes for the id even inside applyExternal", () => {
		const store = createBoardStore();
		store.addShape(makeShape("a"));
		removeShapePermanently(store, "a");
		applyExternal(store, () => store.addShape(makeShape("a")));
		expect(store.getShape("a")).toBeUndefined();
	});

	it("drops the id from the selection", () => {
		const store = createBoardStore();
		store.addShape(makeShape("a"));
		store.setSelection(["a"]);
		const events = recordEvents(store);
		removeShapePermanently(store, "a");
		expect(store.getSelection().has("a")).toBe(false);
		expect(events.map((e) => e.type)).toEqual(["shape:removed", "selection:changed"]);
	});

	it("does nothing while read-only, except for records that arrive through sync", () => {
		const store = createBoardStore();
		store.addShape(makeShape("a"));
		store.addShape(makeShape("b"));
		store.setReadOnly?.(true);

		expect(removeShapePermanently(store, "a")).toBe(false);
		expect(store.getShape("a")).toBeDefined();
		expect(isPermanentlyRemoved(store, "a")).toBe(false);

		expect(applyExternal(store, () => removeShapePermanently(store, "b"))).toBe(true);
		expect(store.getShape("b")).toBeUndefined();
	});

	it("leaves ordinary deletes and their undo unchanged", () => {
		const store = createBoardStore();
		store.addShape(makeShape("a"));
		const events = recordEvents(store);
		const del = createDeleteShapeCommand(store, "a");
		del.execute();
		del.undo();
		expect(store.getShape("a")).toBeDefined();
		expect(events.filter((e) => e.type === "shape:removed")).toEqual([
			{ type: "shape:removed", payload: { id: "a", ids: ["a"] } },
		]);
	});
});
