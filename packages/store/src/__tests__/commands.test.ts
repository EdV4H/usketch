import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createBoardStore } from "../board-store.js";
import {
	createAddShapeCommand,
	createBatchUpdateShapesCommand,
	createBringForwardCommand,
	createBringSelectionToFrontCommand,
	createBringToFrontCommand,
	createDeleteShapeCommand,
	createDeleteWithChildrenCommand,
	createGroupCommand,
	createMoveShapesCommand,
	createReparentCommand,
	createSendBackwardCommand,
	createSendSelectionToBackCommand,
	createSendToBackCommand,
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

	describe("Z-order commands", () => {
		function setupThree() {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			store.addShape(makeShape({ id: "s2" }));
			store.addShape(makeShape({ id: "s3" }));
			return store;
		}

		it("createBringToFrontCommand: moves shape to front", () => {
			const store = setupThree();
			const originalS1Z = store.getShape("s1")!.zIndex;
			const cmd = createBringToFrontCommand(store, "s1");
			cmd.execute();
			const sorted = store.getShapesSorted().map((s) => s.id);
			expect(sorted).toEqual(["s2", "s3", "s1"]);
			cmd.undo();
			expect(store.getShape("s1")!.zIndex).toBe(originalS1Z);
			expect(store.getShapesSorted().map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
		});

		it("createSendToBackCommand: moves shape to back", () => {
			const store = setupThree();
			const cmd = createSendToBackCommand(store, "s3");
			cmd.execute();
			expect(store.getShapesSorted().map((s) => s.id)).toEqual(["s3", "s1", "s2"]);
			cmd.undo();
			expect(store.getShapesSorted().map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
		});

		it("createBringForwardCommand: swaps with next shape", () => {
			const store = setupThree();
			const cmd = createBringForwardCommand(store, "s1");
			cmd.execute();
			expect(store.getShapesSorted().map((s) => s.id)).toEqual(["s2", "s1", "s3"]);
			cmd.undo();
			expect(store.getShapesSorted().map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
		});

		it("createSendBackwardCommand: swaps with previous shape", () => {
			const store = setupThree();
			const cmd = createSendBackwardCommand(store, "s3");
			cmd.execute();
			expect(store.getShapesSorted().map((s) => s.id)).toEqual(["s1", "s3", "s2"]);
			cmd.undo();
			expect(store.getShapesSorted().map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
		});

		it("createBringForwardCommand: no-op when already at front", () => {
			const store = setupThree();
			const originalZ = store.getShape("s3")!.zIndex;
			const cmd = createBringForwardCommand(store, "s3");
			cmd.execute();
			expect(store.getShape("s3")!.zIndex).toBe(originalZ);
		});

		it("createSendBackwardCommand: no-op when already at back", () => {
			const store = setupThree();
			const originalZ = store.getShape("s1")!.zIndex;
			const cmd = createSendBackwardCommand(store, "s1");
			cmd.execute();
			expect(store.getShape("s1")!.zIndex).toBe(originalZ);
		});

		it("createBringSelectionToFrontCommand: preserves relative order", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			store.addShape(makeShape({ id: "s2" }));
			store.addShape(makeShape({ id: "s3" }));
			store.addShape(makeShape({ id: "s4" }));
			// Select s1 and s3 — bringing to front should place them above s2 and s4,
			// with s1 still below s3 (preserved relative order).
			const cmd = createBringSelectionToFrontCommand(store, ["s1", "s3"]);
			cmd.execute();
			expect(store.getShapesSorted().map((s) => s.id)).toEqual(["s2", "s4", "s1", "s3"]);
			cmd.undo();
			expect(store.getShapesSorted().map((s) => s.id)).toEqual(["s1", "s2", "s3", "s4"]);
		});

		it("createSendSelectionToBackCommand: preserves relative order", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "s1" }));
			store.addShape(makeShape({ id: "s2" }));
			store.addShape(makeShape({ id: "s3" }));
			store.addShape(makeShape({ id: "s4" }));
			// Select s2 and s4 — sending to back should place them below s1 and s3,
			// with s2 still below s4 (preserved relative order).
			const cmd = createSendSelectionToBackCommand(store, ["s2", "s4"]);
			cmd.execute();
			expect(store.getShapesSorted().map((s) => s.id)).toEqual(["s2", "s4", "s1", "s3"]);
			cmd.undo();
			expect(store.getShapesSorted().map((s) => s.id)).toEqual(["s1", "s2", "s3", "s4"]);
		});

		it("z-order commands only affect same parentId siblings", () => {
			const store = createBoardStore();
			store.addShape(makeShape({ id: "frame" }));
			store.addShape(makeShape({ id: "child1", parentId: "frame" }));
			store.addShape(makeShape({ id: "child2", parentId: "frame" }));
			store.addShape(makeShape({ id: "top" }));

			// bringToFront on child1 should only reorder within frame's children
			const cmd = createBringToFrontCommand(store, "child1");
			cmd.execute();
			const children = store
				.getShapesSorted()
				.filter((s) => s.parentId === "frame")
				.map((s) => s.id);
			expect(children).toEqual(["child2", "child1"]);
			// top-level shapes unchanged
			const topLevel = store
				.getShapesSorted()
				.filter((s) => !s.parentId)
				.map((s) => s.id);
			expect(topLevel).toEqual(["frame", "top"]);
		});
	});
});
