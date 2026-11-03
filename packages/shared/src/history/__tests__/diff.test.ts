import { describe, expect, it } from "vitest";
import type { ShapeData } from "../../types/shape.js";
import { diffShapeFields, diffTrees } from "../diff.js";

describe("diffTrees", () => {
	it("splits ids into added, removed and modified by hash", () => {
		const diff = diffTrees({ a: "1", b: "2", c: "3" }, { a: "1", b: "9", d: "4" });
		expect(diff).toEqual({ added: ["d"], removed: ["c"], modified: ["b"] });
	});
});

describe("diffShapeFields", () => {
	it("reports changed, added and removed fields by content, skipping updatedAt", () => {
		const before = {
			id: "a",
			type: "rectangle",
			x: 0,
			style: { fillColor: "#fff" },
			meta: { tag: "x" },
			updatedAt: 1,
		} as unknown as ShapeData;
		const after = {
			id: "a",
			type: "rectangle",
			x: 5,
			style: { fillColor: "#fff" },
			hidden: true,
			updatedAt: 2,
		} as unknown as ShapeData;
		expect(diffShapeFields(before, after)).toEqual([
			{ key: "hidden", before: undefined, after: true },
			{ key: "meta", before: { tag: "x" }, after: undefined },
			{ key: "x", before: 0, after: 5 },
		]);
	});
});
