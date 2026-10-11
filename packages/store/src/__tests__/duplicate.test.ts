import type { ShapeData, ShapeDefinition, ShapeRegistry } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createBoardStore } from "../board-store.js";
import { cloneShapes, collectWithDescendants, rootShapeIds } from "../duplicate.js";

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

describe("collectWithDescendants", () => {
	it("collects the given shapes plus every descendant (frame → child → grandchild)", () => {
		const store = createBoardStore();
		store.addShape(makeShape({ id: "frame", type: "frame" }));
		store.addShape(makeShape({ id: "group", type: "group", parentId: "frame" }));
		store.addShape(makeShape({ id: "leaf", parentId: "group" }));
		store.addShape(makeShape({ id: "other" }));

		const ids = collectWithDescendants(store, ["frame"]).map((s) => s.id);
		expect(ids.sort()).toEqual(["frame", "group", "leaf"]);
	});

	it("does not duplicate a descendant that is also selected", () => {
		const store = createBoardStore();
		store.addShape(makeShape({ id: "frame", type: "frame" }));
		store.addShape(makeShape({ id: "child", parentId: "frame" }));

		const ids = collectWithDescendants(store, ["frame", "child"]).map((s) => s.id);
		expect(ids.sort()).toEqual(["child", "frame"]);
	});

	it("ignores ids that are not in the store", () => {
		const store = createBoardStore();
		store.addShape(makeShape({ id: "a" }));
		expect(collectWithDescendants(store, ["a", "missing"]).map((s) => s.id)).toEqual(["a"]);
	});
});

describe("cloneShapes", () => {
	it("assigns new ids and offsets positions", () => {
		const { shapes, idMap } = cloneShapes([makeShape({ id: "a", x: 10, y: 20 })], {
			dx: 5,
			dy: 7,
		});
		expect(shapes).toHaveLength(1);
		expect(shapes[0]?.id).not.toBe("a");
		expect(idMap.get("a")).toBe(shapes[0]?.id);
		expect(shapes[0]).toMatchObject({ x: 15, y: 27 });
	});

	it("remaps parentId to the copied parent, keeps it when the parent is not copied", () => {
		const { shapes, idMap } = cloneShapes([
			makeShape({ id: "frame", type: "frame" }),
			makeShape({ id: "child", parentId: "frame" }),
			makeShape({ id: "orphan", parentId: "outside" }),
		]);
		const byOld = (old: string) => shapes.find((s) => s.id === idMap.get(old));
		expect(byOld("child")?.parentId).toBe(idMap.get("frame"));
		expect(byOld("orphan")?.parentId).toBe("outside");
	});

	it("rewires connector sourceId/targetId to the copies when both ends are copied", () => {
		const { shapes, idMap } = cloneShapes([
			makeShape({ id: "A" }),
			makeShape({ id: "B" }),
			makeShape({ id: "C", type: "connector", sourceId: "A", targetId: "B" }),
		]);
		const conn = shapes.find((s) => s.id === idMap.get("C"));
		expect(conn?.sourceId).toBe(idMap.get("A"));
		expect(conn?.targetId).toBe(idMap.get("B"));
	});

	it("keeps the original endpoint when only one end is copied", () => {
		const { shapes, idMap } = cloneShapes([
			makeShape({ id: "A" }),
			makeShape({ id: "C", type: "connector", sourceId: "A", targetId: "B" }),
		]);
		const conn = shapes.find((s) => s.id === idMap.get("C"));
		expect(conn?.sourceId).toBe(idMap.get("A"));
		expect(conn?.targetId).toBe("B");
	});

	it("uses ShapeDefinition.move when the registry provides one", () => {
		const registry = {
			get: (type: string) =>
				type === "connector"
					? ({
							move: (s: ShapeData, dx: number, dy: number) => ({
								x: s.x + dx,
								y: s.y + dy,
								sourcePoint: { x: dx, y: dy },
							}),
						} as unknown as ShapeDefinition)
					: undefined,
		} as unknown as ShapeRegistry;
		const { shapes } = cloneShapes([makeShape({ id: "C", type: "connector" })], {
			dx: 3,
			dy: 4,
			registry,
		});
		expect(shapes[0]).toMatchObject({ x: 3, y: 4, sourcePoint: { x: 3, y: 4 } });
	});

	it("does not mutate the input shapes", () => {
		const input = makeShape({ id: "a", x: 1 });
		cloneShapes([input], { dx: 10, dy: 10 });
		expect(input).toMatchObject({ id: "a", x: 1 });
	});
});

describe("rootShapeIds", () => {
	it("returns shapes whose parent is not part of the set", () => {
		const ids = rootShapeIds([
			makeShape({ id: "frame", type: "frame" }),
			makeShape({ id: "child", parentId: "frame" }),
			makeShape({ id: "inOuter", parentId: "outer" }),
		]);
		expect(ids).toEqual(["frame", "inOuter"]);
	});
});
