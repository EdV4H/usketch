import type { Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { duplicateShapes } from "../clipboard.js";

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

/** Minimal undo stack: one `execute` = one undo step. */
function createCommandRegistry(): CommandRegistry {
	const history: Command[] = [];
	return {
		execute(cmd: Command) {
			cmd.execute();
			history.push(cmd);
		},
		undo() {
			history.pop()?.undo();
		},
	} as unknown as CommandRegistry;
}

beforeEach(() => {
	vi.stubGlobal("document", { activeElement: null });
});

describe("duplicateShapes (Cmd+D)", () => {
	it("rewires a duplicated connector to the duplicated endpoints", () => {
		const store = createBoardStore();
		const commands = createCommandRegistry();
		store.addShape(makeShape({ id: "A" }));
		store.addShape(makeShape({ id: "B", x: 300 }));
		store.addShape(makeShape({ id: "C", type: "connector", sourceId: "A", targetId: "B" }));
		store.setSelection(["A", "B", "C"]);

		duplicateShapes(store, commands);

		const newIds = [...store.getSelection()];
		expect(newIds).toHaveLength(3);
		const conn = newIds.map((id) => store.getShape(id)).find((s) => s?.type === "connector");
		expect(newIds).toContain(conn?.sourceId);
		expect(newIds).toContain(conn?.targetId);
	});

	it("duplicates the children of a selected frame and selects only the new frame", () => {
		const store = createBoardStore();
		const commands = createCommandRegistry();
		store.addShape(makeShape({ id: "frame", type: "frame", width: 500, height: 500 }));
		store.addShape(makeShape({ id: "child", parentId: "frame" }));
		store.setSelection(["frame"]);

		duplicateShapes(store, commands);

		const [newFrameId] = [...store.getSelection()];
		expect(store.getSelection().size).toBe(1);
		expect(newFrameId).not.toBe("frame");
		const newChildren = [...store.getShapes().values()].filter((s) => s.parentId === newFrameId);
		expect(newChildren).toHaveLength(1);
		expect(store.getShapes().size).toBe(4);
	});

	it("duplicates a connector between children of a selected frame", () => {
		const store = createBoardStore();
		const commands = createCommandRegistry();
		store.addShape(makeShape({ id: "frame", type: "frame", width: 500, height: 500 }));
		store.addShape(makeShape({ id: "A", parentId: "frame" }));
		store.addShape(makeShape({ id: "B", parentId: "frame", x: 300 }));
		// Connectors never get a parentId, so they are not descendants of the frame.
		store.addShape(makeShape({ id: "C", type: "connector", sourceId: "A", targetId: "B" }));
		store.setSelection(["frame"]);

		duplicateShapes(store, commands);

		const conns = [...store.getShapes().values()].filter((s) => s.type === "connector");
		expect(conns).toHaveLength(2);
		const copy = conns.find((c) => c.id !== "C");
		const copyA = store.getShape(copy?.sourceId as string);
		expect(copyA?.id).not.toBe("A");
		expect(copyA?.parentId).not.toBe("frame");
	});

	it("is undone in a single step", () => {
		const store = createBoardStore();
		const commands = createCommandRegistry();
		store.addShape(makeShape({ id: "a" }));
		store.addShape(makeShape({ id: "b", x: 200 }));
		store.setSelection(["a", "b"]);

		duplicateShapes(store, commands);
		expect(store.getShapes().size).toBe(4);

		commands.undo();
		expect([...store.getShapes().keys()].sort()).toEqual(["a", "b"]);
	});
});
