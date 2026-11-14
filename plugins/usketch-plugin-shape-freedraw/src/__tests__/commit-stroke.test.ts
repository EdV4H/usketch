import { createCommandRegistry } from "@edv4h/usketch-core";
import type { Command } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it, vi } from "vitest";
import type { FreedrawPenDefinition } from "../custom-pens.js";
import { commitStroke } from "../draw-tool.js";
import type { FreedrawShapeData } from "../types.js";

const stroke: FreedrawShapeData = {
	id: "road-1",
	type: "freedraw",
	x: 0,
	y: 0,
	width: 100,
	height: 10,
	style: { fill: "transparent", stroke: "#000", strokeWidth: 10, opacity: 1 },
	points: [
		{ x: 0, y: 5, p: 0.5 },
		{ x: 100, y: 5, p: 0.5 },
	],
	pen: "road",
} as FreedrawShapeData;

const pen = (onCommit: FreedrawPenDefinition["onCommit"]): FreedrawPenDefinition => ({
	id: "road",
	label: "road",
	defaultSize: 10,
	render: () => null as never,
	onCommit,
});

/** A follow-up that sets `marker.value` (undoable). */
const marker = { value: 0 };
const setMarker = (to: number): Command => {
	let before = 0;
	return {
		execute: () => {
			before = marker.value;
			marker.value = to;
		},
		undo: () => {
			marker.value = before;
		},
	};
};

describe("commitStroke", () => {
	it("runs the pen's onCommit once, on the stroke as stored", () => {
		const store = createBoardStore();
		const commands = createCommandRegistry();
		const onCommit = vi.fn();
		commands.execute(commitStroke(store, stroke, pen(onCommit)));
		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit.mock.calls[0][0]).toMatchObject({ id: "road-1", pen: "road" });
		expect(store.getShape("road-1")).toBeDefined();
	});

	it("puts the follow-ups in the stroke's undo step and replays them on redo", () => {
		marker.value = 0;
		const store = createBoardStore();
		const commands = createCommandRegistry();
		const onCommit = vi.fn((_s, ctx) => ctx.commands.execute(setMarker(7)));
		commands.execute(commitStroke(store, stroke, pen(onCommit)));
		expect(marker.value).toBe(7);
		expect(commands.getHistorySize()).toBe(1);
		commands.undo();
		expect(marker.value).toBe(0);
		expect(store.getShape("road-1")).toBeUndefined();
		commands.redo();
		expect(marker.value).toBe(7);
		expect(store.getShape("road-1")).toBeDefined();
		expect(onCommit).toHaveBeenCalledTimes(1);
	});

	it("keeps the stroke when onCommit throws", () => {
		const store = createBoardStore();
		const commands = createCommandRegistry();
		const err = vi.spyOn(console, "error").mockImplementation(() => {});
		commands.execute(
			commitStroke(
				store,
				stroke,
				pen(() => {
					throw new Error("boom");
				}),
			),
		);
		expect(store.getShape("road-1")).toBeDefined();
		expect(err).toHaveBeenCalled();
		err.mockRestore();
	});

	it("is a plain add without a pen hook", () => {
		const store = createBoardStore();
		const commands = createCommandRegistry();
		commands.execute(commitStroke(store, stroke, undefined));
		commands.undo();
		expect(store.getShape("road-1")).toBeUndefined();
	});
});
