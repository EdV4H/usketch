import { describe, expect, it } from "vitest";
import type { BoardStore } from "../../types/plugin.js";
import type { ShapeData } from "../../types/shape.js";
import { createRestoreCommand, isEmptyRestorePlan, planRestore } from "../restore.js";

const style = { fillColor: "#fff", strokeColor: "#000", strokeWidth: 1, opacity: 1 };

function shape(id: string, extra: Partial<ShapeData> = {}): ShapeData {
	return { id, type: "rectangle", x: 0, y: 0, width: 10, height: 10, style, ...extra } as ShapeData;
}

/** Just enough of BoardStore for restores: a Map with add/update/delete. */
function fakeStore(initial: ShapeData[]): BoardStore {
	let shapes = new Map(initial.map((s) => [s.id, s]));
	return {
		getShapes: () => shapes,
		getShape: (id: string) => shapes.get(id),
		addShape: (s: ShapeData) => {
			shapes = new Map(shapes).set(s.id, { ...s, updatedAt: 99 });
		},
		updateShape: (id: string, changes: Partial<ShapeData>) => {
			const existing = shapes.get(id);
			if (existing) shapes = new Map(shapes).set(id, { ...existing, ...changes, id });
		},
		deleteShape: (id: string) => {
			shapes = new Map(shapes);
			shapes.delete(id);
		},
	} as unknown as BoardStore;
}

/** Store contents without keys history ignores and without undefined values. */
function contents(store: BoardStore): unknown {
	return JSON.parse(
		JSON.stringify(
			[...store.getShapes().values()]
				.map(({ updatedAt: _, ...rest }) => rest)
				.sort((a, b) => a.id.localeCompare(b.id)),
		),
	);
}

describe("planRestore", () => {
	it("adds, removes and updates to reach the target", () => {
		const plan = planRestore(
			[shape("keep"), shape("moved", { x: 1, hidden: true }), shape("gone")],
			[shape("keep"), shape("moved", { x: 5 }), shape("new")],
		);
		expect(plan.add.map((s) => s.id)).toEqual(["new"]);
		expect(plan.remove).toEqual(["gone"]);
		expect(plan.update).toEqual([{ id: "moved", changes: { x: 5, hidden: undefined } }]);
	});

	it("re-creates a shape whose type changed and adds parents before children", () => {
		const plan = planRestore(
			[shape("a")],
			[
				shape("child", { parentId: "frame" }),
				shape("frame", { type: "frame" }),
				{ ...shape("a"), type: "ellipse" },
			],
		);
		expect(plan.remove).toEqual(["a"]);
		expect(plan.add.map((s) => s.id)).toEqual(["a", "frame", "child"]);
	});

	it("ignores updatedAt so an unchanged board gives an empty plan", () => {
		const plan = planRestore([shape("a", { updatedAt: 1 })], [shape("a", { updatedAt: 2 })]);
		expect(isEmptyRestorePlan(plan)).toBe(true);
	});

	it("only touches the given ids when scoped", () => {
		const plan = planRestore([shape("a", { x: 1 }), shape("b", { x: 1 })], [shape("a", { x: 2 })], {
			ids: ["a"],
		});
		expect(plan).toEqual({ add: [], remove: [], update: [{ id: "a", changes: { x: 2 } }] });
	});
});

describe("createRestoreCommand", () => {
	it("restores the target and undo brings the board back", () => {
		const store = fakeStore([shape("a", { x: 1 }), shape("b")]);
		const original = contents(store);
		const target = [shape("a", { x: 9 }), shape("c")];

		const command = createRestoreCommand(store, target);
		command.execute();
		expect(contents(store)).toEqual(JSON.parse(JSON.stringify(target)));

		command.undo();
		expect(contents(store)).toEqual(original);

		command.execute();
		expect(contents(store)).toEqual(JSON.parse(JSON.stringify(target)));
	});

	it("leaves shapes outside the scope alone", () => {
		const store = fakeStore([shape("a", { x: 1 }), shape("b", { x: 1 })]);
		createRestoreCommand(store, [shape("a", { x: 2 })], { ids: ["a"] }).execute();
		expect(store.getShape("a")?.x).toBe(2);
		expect(store.getShape("b")?.x).toBe(1);
	});
});
