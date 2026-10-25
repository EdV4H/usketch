import type { Command, ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore, createContainmentAttacher } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import {
	addDragCopies,
	commitDragCopies,
	duplicateTargetIds,
	removeDragCopies,
	resolveCopyParents,
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

const isFrame = (s: ShapeData) => s.type === "frame";

/** BoardStore + a containment attacher (frames are attach targets) + a recording history. */
function setup() {
	const store = createBoardStore();
	const history: Command[] = [];
	const commands = {
		execute(cmd: Command) {
			cmd.execute();
			history.push(cmd);
		},
		undo() {
			history.pop()?.undo();
		},
	};
	const noopEvents = { on: () => () => {}, emit: () => {} };
	createContainmentAttacher({
		store,
		commands: commands as never,
		events: noopEvents as never,
		isAttachTarget: isFrame,
	});
	return { store, history, commands };
}

const others = (store: ReturnType<typeof createBoardStore>, ids: string[]) =>
	[...store.getShapes().values()].filter((s) => !ids.includes(s.id));

describe("duplicateTargetIds", () => {
	it("adds connectors running between the moving shapes (frame children)", () => {
		const store = createBoardStore();
		store.addShape(makeShape({ id: "frame", type: "frame", width: 500, height: 500 }));
		store.addShape(makeShape({ id: "A", parentId: "frame" }));
		store.addShape(makeShape({ id: "B", parentId: "frame", x: 300 }));
		store.addShape(makeShape({ id: "C", type: "connector", sourceId: "A", targetId: "B" }));
		store.addShape(makeShape({ id: "out", type: "connector", sourceId: "A", targetId: "Z" }));

		expect(duplicateTargetIds(store, ["frame", "A", "B"])).toEqual(["frame", "A", "B", "C"]);
	});
});

describe("addDragCopies / commitDragCopies", () => {
	it("adds copies at the originals' place without history, rewiring internal references", () => {
		const { store, history } = setup();
		store.addShape(makeShape({ id: "frame", type: "frame", width: 500, height: 500 }));
		store.addShape(makeShape({ id: "A", parentId: "frame" }));
		store.addShape(makeShape({ id: "B", parentId: "frame", x: 300 }));
		store.addShape(makeShape({ id: "C", type: "connector", sourceId: "A", targetId: "B" }));

		const copies = addDragCopies(store, ["frame"], ["frame", "A", "B"], isFrame);

		expect(copies.shapes).toHaveLength(4);
		expect(copies.rootIds).toHaveLength(1);
		const frameCopy = store.getShape(copies.rootIds[0] as string);
		expect(frameCopy).toMatchObject({ type: "frame", x: 0, y: 0 });
		const kids = others(store, ["frame", "A", "B", "C"]).filter(
			(s) => s.parentId === frameCopy?.id,
		);
		expect(kids).toHaveLength(2);
		const conn = copies.shapes.find((s) => s.type === "connector");
		expect(kids.map((k) => k.id).sort()).toEqual([conn?.sourceId, conn?.targetId].sort());
		expect(history).toHaveLength(0);
	});

	it("keeps the children of a duplicated group in the copied group", () => {
		const { store, history } = setup();
		store.addShape(makeShape({ id: "g", type: "group", x: 0, y: 0, width: 10, height: 10 }));
		store.addShape(makeShape({ id: "A", parentId: "g", x: 0, y: 0 }));

		const copies = addDragCopies(store, ["g"], ["g", "A"], isFrame);

		const [groupCopy] = copies.rootIds;
		const childCopy = copies.shapes.find((s) => s.id !== groupCopy);
		expect(store.getShape(childCopy?.id as string)?.parentId).toBe(groupCopy);
		expect(history).toHaveLength(0);
	});

	it("replaces the copies with one undoable add at their dropped position", () => {
		const { store, history, commands } = setup();
		store.addShape(makeShape({ id: "A" }));
		const copies = addDragCopies(store, ["A"], ["A"], isFrame);
		const copyId = copies.rootIds[0] as string;
		store.updateShape(copyId, { x: 400, y: 50 });

		const add = commitDragCopies(store, copies, isFrame);
		expect(store.getShape(copyId)).toBeUndefined();
		commands.execute(add);

		expect(store.getShape(copyId)).toMatchObject({ x: 400, y: 50 });
		expect(store.getShape("A")).toMatchObject({ x: 0, y: 0 });
		expect(history).toHaveLength(1);
		commands.undo();
		expect([...store.getShapes().keys()]).toEqual(["A"]);
	});

	it("attaches a copy dropped into a frame (and detaches one dropped out) without extra undo steps", () => {
		const { store, history, commands } = setup();
		store.addShape(makeShape({ id: "frame", type: "frame", x: 0, y: 0, width: 500, height: 500 }));
		store.addShape(makeShape({ id: "A", parentId: "frame", x: 10, y: 10 }));
		store.addShape(makeShape({ id: "B", x: 1000, y: 0 }));

		const out = addDragCopies(store, ["A"], ["A"], isFrame);
		store.updateShape(out.rootIds[0] as string, { x: 700, y: 10 });
		commands.execute(commitDragCopies(store, out, isFrame));
		expect(store.getShape(out.rootIds[0] as string)?.parentId).toBeUndefined();

		const inside = addDragCopies(store, ["B"], ["B"], isFrame);
		store.updateShape(inside.rootIds[0] as string, { x: 200, y: 200 });
		commands.execute(commitDragCopies(store, inside, isFrame));
		expect(store.getShape(inside.rootIds[0] as string)?.parentId).toBe("frame");

		expect(history).toHaveLength(2);
	});

	it("removeDragCopies takes every copy back out", () => {
		const { store } = setup();
		store.addShape(makeShape({ id: "A" }));
		store.addShape(makeShape({ id: "B", x: 300 }));
		store.addShape(makeShape({ id: "C", type: "connector", sourceId: "A", targetId: "B" }));
		const copies = addDragCopies(store, ["A", "B"], ["A", "B"], isFrame);
		expect(store.getShapes().size).toBe(6);

		removeDragCopies(store, copies);
		expect([...store.getShapes().keys()]).toEqual(["A", "B", "C"]);
	});
});

describe("resolveCopyParents", () => {
	it("leaves connectors, frames and children of other copies alone", () => {
		const store = createBoardStore();
		store.addShape(makeShape({ id: "frame", type: "frame", width: 500, height: 500 }));
		const shapes = [
			makeShape({ id: "f2", type: "frame", x: 10, y: 10, width: 100, height: 100 }),
			makeShape({ id: "kid", parentId: "f2", x: 20, y: 20, width: 10, height: 10 }),
			makeShape({ id: "conn", type: "connector", x: 20, y: 20, width: 1, height: 1 }),
			makeShape({ id: "loose", x: 300, y: 300, width: 10, height: 10 }),
		];
		const resolved = resolveCopyParents(store, shapes, isFrame);
		expect(resolved.map((s) => s.parentId)).toEqual([undefined, "f2", undefined, "frame"]);
	});
});
