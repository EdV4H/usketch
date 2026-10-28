import type { ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { createDeleteSelectionCommand } from "../delete-selection.js";

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

function setup() {
	const store = createBoardStore();
	store.addShape(makeShape({ id: "frame", type: "frame", width: 500, height: 500 }));
	store.addShape(makeShape({ id: "A", parentId: "frame" }));
	store.addShape(makeShape({ id: "B", parentId: "frame", x: 300 }));
	return store;
}

describe("createDeleteSelectionCommand", () => {
	it("deletes a frame with its contents by default", () => {
		const store = setup();
		store.setSelection(["frame"]);
		createDeleteSelectionCommand(store)?.execute();
		expect(store.getShapes().size).toBe(0);
	});

	it('"self" deletes only the frame and leaves its contents in place', () => {
		const store = setup();
		store.setSelection(["frame"]);
		const cmd = createDeleteSelectionCommand(store, "self");
		cmd?.execute();
		expect(store.getShape("frame")).toBeUndefined();
		expect(store.getShape("A")).toMatchObject({ x: 0, parentId: undefined });
		expect(store.getShape("B")).toMatchObject({ x: 300, parentId: undefined });

		cmd?.undo();
		expect(store.getShape("A")?.parentId).toBe("frame");
	});

	it("skips locked and hidden shapes, and returns null when nothing is deletable", () => {
		const store = setup();
		store.updateShape("frame", { locked: true, lockScope: "self" });
		store.updateShape("B", { hidden: true });
		store.setSelection(["frame", "B"]);
		expect(createDeleteSelectionCommand(store)).toBeNull();

		store.setSelection(["frame", "A"]);
		createDeleteSelectionCommand(store)?.execute();
		expect(store.getShape("frame")).toBeDefined();
		expect(store.getShape("A")).toBeUndefined();
	});
});
