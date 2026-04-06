import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createBoardStore } from "../board-store.js";
import {
	createAddShapeCommand,
	createBatchUpdateShapesCommand,
	createDeleteShapeCommand,
	createDeleteWithChildrenCommand,
	createGroupCommand,
	createMoveShapesCommand,
	createReparentCommand,
	createUngroupCommand,
	createUpdateShapeCommand,
} from "../commands.js";

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

describe("Commands", () => {
	describe("createAddShapeCommand", () => {
		it("execute adds shape, undo removes it", () => {
			const store = createBoardStore();
			const cmd = createAddShapeCommand(store, makeShape({ id: "s1" }));

			cmd.execute();
			expect(store.getShape("s1")).toBeDefined();

			cmd.undo();
			expect(store.getShape("s1")).toBeUndefined();
		});
	});

	describe("createDeleteShapeCommand", () => {
		it("execute deletes shape, undo restores it", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1", x: 42 }));

			const cmd = createDeleteShapeCommand(store, "s1");
			cmd.execute();
			expect(store.getShape("s1")).toBeUndefined();

			cmd.undo();
			expect(store.getShape("s1")).toBeDefined();
			expect(store.getShape("s1")!.x).toBe(42);
		});
	});

	describe("createMoveShapesCommand", () => {
		it("execute applies after snapshots, undo applies before", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1", x: 0, y: 0 }));
			store.addShape(makeShape({ id: "s2", x: 10, y: 10 }));

			const before = new Map<string, ShapeData>([
				["s1", makeShape({ id: "s1", x: 0, y: 0 })],
				["s2", makeShape({ id: "s2", x: 10, y: 10 })],
			]);
			const after = new Map<string, ShapeData>([
				["s1", makeShape({ id: "s1", x: 100, y: 200 })],
				["s2", makeShape({ id: "s2", x: 110, y: 210 })],
			]);

			const cmd = createMoveShapesCommand(store, before, after);
			cmd.execute();
			expect(store.getShape("s1")!.x).toBe(100);
			expect(store.getShape("s2")!.x).toBe(110);

			cmd.undo();
			expect(store.getShape("s1")!.x).toBe(0);
			expect(store.getShape("s2")!.x).toBe(10);
		});
	});

	describe("createUpdateShapeCommand", () => {
		it("execute applies to, undo applies from", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1", x: 0 }));

			const cmd = createUpdateShapeCommand(store, "s1", { x: 0 }, { x: 50 });
			cmd.execute();
			expect(store.getShape("s1")!.x).toBe(50);

			cmd.undo();
			expect(store.getShape("s1")!.x).toBe(0);
		});
	});

	describe("createBatchUpdateShapesCommand", () => {
		it("execute/undo applies batch updates", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1", x: 0 }));
			store.addShape(makeShape({ id: "s2", x: 10 }));

			const cmd = createBatchUpdateShapesCommand(store, [
				{ id: "s1", from: { x: 0 }, to: { x: 100 } },
				{ id: "s2", from: { x: 10 }, to: { x: 200 } },
			]);

			cmd.execute();
			expect(store.getShape("s1")!.x).toBe(100);
			expect(store.getShape("s2")!.x).toBe(200);

			cmd.undo();
			expect(store.getShape("s1")!.x).toBe(0);
			expect(store.getShape("s2")!.x).toBe(10);
		});
	});

	describe("createGroupCommand", () => {
		it("execute creates group and sets parentId, undo reverses", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "c1" }));
			store.addShape(makeShape({ id: "c2" }));

			const groupShape = makeShape({ id: "g1", type: "group" });
			const cmd = createGroupCommand(store, groupShape, ["c1", "c2"]);

			cmd.execute();
			expect(store.getShape("g1")).toBeDefined();
			expect(store.getShape("c1")!.parentId).toBe("g1");
			expect(store.getShape("c2")!.parentId).toBe("g1");

			cmd.undo();
			expect(store.getShape("g1")).toBeUndefined();
			expect(store.getShape("c1")!.parentId).toBeUndefined();
			expect(store.getShape("c2")!.parentId).toBeUndefined();
		});
	});

	describe("createUngroupCommand", () => {
		it("execute removes group and clears parentId, undo restores", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "g1", type: "group" }));
			store.addShape(makeShape({ id: "c1", parentId: "g1" } as ShapeData));
			store.addShape(makeShape({ id: "c2", parentId: "g1" } as ShapeData));

			const cmd = createUngroupCommand(store, "g1");
			cmd.execute();
			expect(store.getShape("g1")).toBeUndefined();
			expect(store.getShape("c1")!.parentId).toBeUndefined();

			cmd.undo();
			expect(store.getShape("g1")).toBeDefined();
			expect(store.getShape("c1")!.parentId).toBe("g1");
		});
	});

	describe("createReparentCommand", () => {
		it("moves shapes to new parent, undo restores", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "frame1", type: "frame" }));
			store.addShape(makeShape({ id: "s1" }));

			const cmd = createReparentCommand(store, ["s1"], "frame1");
			cmd.execute();
			expect(store.getShape("s1")!.parentId).toBe("frame1");

			cmd.undo();
			expect(store.getShape("s1")!.parentId).toBeUndefined();
		});
	});

	describe("createDeleteWithChildrenCommand", () => {
		it("deletes parent and children recursively, undo restores", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "g1", type: "group" }));
			store.addShape(makeShape({ id: "c1", parentId: "g1" } as ShapeData));
			store.addShape(makeShape({ id: "c2", parentId: "g1" } as ShapeData));
			store.addShape(makeShape({ id: "other" }));

			const cmd = createDeleteWithChildrenCommand(store, "g1");
			cmd.execute();
			expect(store.getShape("g1")).toBeUndefined();
			expect(store.getShape("c1")).toBeUndefined();
			expect(store.getShape("c2")).toBeUndefined();
			expect(store.getShape("other")).toBeDefined();

			cmd.undo();
			expect(store.getShape("g1")).toBeDefined();
			expect(store.getShape("c1")).toBeDefined();
			expect(store.getShape("c2")).toBeDefined();
		});

		it("also deletes connectors attached to deleted shapes", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			store.addShape(makeShape({ id: "s2" }));
			store.addShape(
				makeShape({ id: "conn1", type: "connector", sourceId: "s1", targetId: "s2" } as ShapeData),
			);

			const cmd = createDeleteWithChildrenCommand(store, "s1");
			cmd.execute();
			expect(store.getShape("s1")).toBeUndefined();
			expect(store.getShape("conn1")).toBeUndefined();
			expect(store.getShape("s2")).toBeDefined();
		});
	});
});
