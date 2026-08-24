import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { connectorNeighbors, parentChildren, resolveItems } from "../resolvers.js";
import type { ScatterItem } from "../types.js";

function store(shapes: Partial<ShapeData>[]): Pick<BoardStore, "getShapes"> {
	const map = new Map(shapes.map((s) => [s.id as string, s as ShapeData]));
	return { getShapes: () => map as ReadonlyMap<string, ShapeData> };
}
const ids = (items: ScatterItem[]) => items.map((i) => (i.kind === "existing" ? i.id : "?")).sort();

describe("connectorNeighbors", () => {
	it("returns the opposite endpoint of every connector touching the seed", () => {
		const s = store([
			{ id: "seed", type: "rect" },
			{ id: "a", type: "rect" },
			{ id: "b", type: "rect" },
			{ id: "c1", type: "connector", sourceId: "seed", targetId: "a" },
			{ id: "c2", type: "connector", sourceId: "b", targetId: "seed" },
			{ id: "c3", type: "connector", sourceId: "a", targetId: "b" }, // unrelated
		] as Partial<ShapeData>[]);
		expect(ids(connectorNeighbors({ store: s as BoardStore }, "seed"))).toEqual(["a", "b"]);
	});

	it("ignores self-loops and shapes without connector fields", () => {
		const s = store([
			{ id: "seed", type: "rect" },
			{ id: "loop", type: "connector", sourceId: "seed", targetId: "seed" },
		] as Partial<ShapeData>[]);
		expect(connectorNeighbors({ store: s as BoardStore }, "seed")).toEqual([]);
	});
});

describe("parentChildren", () => {
	it("returns shapes whose parentId is the seed", () => {
		const s = store([
			{ id: "g", type: "group" },
			{ id: "a", type: "rect", parentId: "g" },
			{ id: "b", type: "rect", parentId: "g" },
			{ id: "c", type: "rect" },
		] as Partial<ShapeData>[]);
		expect(ids(parentChildren({ store: s as BoardStore }, "g"))).toEqual(["a", "b"]);
	});
});

describe("resolveItems", () => {
	const s = store([
		{ id: "seed", type: "rect" },
		{ id: "a", type: "rect", parentId: "seed" },
	] as Partial<ShapeData>[]);

	it("prefers explicit items over the relation resolver", () => {
		const explicit: ScatterItem[] = [{ kind: "existing", id: "x" }];
		expect(resolveItems({ store: s as BoardStore }, "seed", "children", explicit)).toBe(explicit);
	});

	it("runs a named resolver when no explicit items", () => {
		expect(ids(resolveItems({ store: s as BoardStore }, "seed", "children", undefined))).toEqual([
			"a",
		]);
	});

	it("throws on an unknown resolver name", () => {
		expect(() => resolveItems({ store: s as BoardStore }, "seed", "nope", undefined)).toThrow();
	});
});
