import type { ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import {
	getFrameShapes,
	setFrameDeleteContents,
	shouldDeleteFrameContents,
} from "../frame-service.js";
import { createDefaultFrame } from "../shapes/frame.js";
import type { FrameShapeData } from "../types.js";

function setup() {
	const store = createBoardStore();
	store.addShape(createDefaultFrame({ id: "f1", x: 0, y: 0 }));
	store.addShape(createDefaultFrame({ id: "f2", x: 400, y: 0 }));
	store.addShape({
		id: "r1",
		type: "rectangle",
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	} as ShapeData);
	const frame = (id: string) => store.getShape(id) as FrameShapeData;
	return { store, frame };
}

describe("getFrameShapes", () => {
	it("returns only frames among the ids", () => {
		const { store } = setup();
		expect(getFrameShapes(store, ["f1", "r1", "missing"]).map((f) => f.id)).toEqual(["f1"]);
	});
});

describe("setFrameDeleteContents", () => {
	it("defaults to deleting contents", () => {
		const { frame } = setup();
		expect(shouldDeleteFrameContents(frame("f1"))).toBe(true);
	});

	it("turns the option off and on for the selected frames, undoably", () => {
		const { store, frame } = setup();
		const off = setFrameDeleteContents(store, ["f1", "f2", "r1"], false);
		off?.execute();
		expect(frame("f1").deleteContents).toBe(false);
		expect(frame("f2").deleteContents).toBe(false);
		expect(store.getShape("r1")).not.toHaveProperty("deleteContents");

		off?.undo();
		expect(shouldDeleteFrameContents(frame("f1"))).toBe(true);

		off?.execute();
		setFrameDeleteContents(store, ["f1"], true)?.execute();
		expect(frame("f1").deleteContents).toBeUndefined();
		expect(shouldDeleteFrameContents(frame("f1"))).toBe(true);
	});

	it("returns null when nothing changes", () => {
		const { store } = setup();
		expect(setFrameDeleteContents(store, ["f1"], true)).toBeNull();
		expect(setFrameDeleteContents(store, ["r1"], false)).toBeNull();
	});
});
