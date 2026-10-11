import type { ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import {
	addDuplicatePreview,
	cloneAtCurrentPositions,
	removeShapes,
	restoreShapes,
} from "../duplicate-drag.js";

function makeShape(overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: overrides.id ?? "s1",
		type: overrides.type ?? "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...overrides,
	};
}

describe("addDuplicatePreview", () => {
	it("adds copies at the drag-start positions and returns their ids", () => {
		const store = createBoardStore();
		const start = makeShape({ id: "a", x: 0 });
		store.addShape(start);
		// The original is being dragged; it is no longer at its start position.
		store.updateShape("a", { x: 100 });

		const ids = addDuplicatePreview(store, [start]);

		expect(ids).toHaveLength(1);
		expect(store.getShape(ids[0] as string)).toMatchObject({ x: 0, type: "rectangle" });
		expect(store.getShape("a")?.x).toBe(100);
	});
});

describe("removeShapes", () => {
	it("deletes the given shapes", () => {
		const store = createBoardStore();
		store.addShape(makeShape({ id: "a" }));
		store.addShape(makeShape({ id: "b" }));
		removeShapes(store, ["a"]);
		expect([...store.getShapes().keys()]).toEqual(["b"]);
	});
});

describe("cloneAtCurrentPositions", () => {
	it("copies the moving shapes where they are now, with internal references rewired", () => {
		const store = createBoardStore();
		store.addShape(makeShape({ id: "frame", type: "frame", x: 200 }));
		store.addShape(makeShape({ id: "child", parentId: "frame", x: 210 }));
		store.addShape(makeShape({ id: "C", type: "connector", sourceId: "child", targetId: "X" }));

		const clones = cloneAtCurrentPositions(store, ["frame", "child", "C"]);

		expect(clones).toHaveLength(3);
		const ids = new Set(clones.map((c) => c.id));
		expect(ids.has("frame")).toBe(false);
		const frame = clones.find((c) => c.type === "frame");
		const child = clones.find((c) => c.type === "rectangle");
		const conn = clones.find((c) => c.type === "connector");
		expect(frame?.x).toBe(200);
		expect(child?.parentId).toBe(frame?.id);
		expect(conn?.sourceId).toBe(child?.id);
		expect(conn?.targetId).toBe("X");
		// Store is untouched — the caller commits the clones through a command.
		expect(store.getShapes().size).toBe(3);
	});
});

describe("restoreShapes", () => {
	it("writes the snapshots back and skips shapes that are gone", () => {
		const store = createBoardStore();
		const start = makeShape({ id: "a", x: 0, y: 0 });
		store.addShape(start);
		store.updateShape("a", { x: 3, y: -2 });

		restoreShapes(store, [start, makeShape({ id: "gone" })]);

		expect(store.getShape("a")).toMatchObject({ x: 0, y: 0 });
		expect(store.getShape("gone")).toBeUndefined();
	});
});
