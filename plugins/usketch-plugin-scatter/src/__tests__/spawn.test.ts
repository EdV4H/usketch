import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { cloneSeedItems } from "../spawn.js";

function store(shapes: Partial<ShapeData>[]): Pick<BoardStore, "getShape"> {
	const m = new Map(shapes.map((s) => [s.id as string, s as ShapeData]));
	return { getShape: (id: string) => m.get(id) };
}

describe("cloneSeedItems", () => {
	it("clones the seed into N new specs (type/size/intrinsic, no id/pos/parent)", () => {
		const s = store([
			{
				id: "seed",
				type: "sticky",
				x: 10,
				y: 20,
				width: 100,
				height: 80,
				parentId: "g",
				zIndex: "a0",
				createdAt: 12345,
				style: { fill: "#f00" } as ShapeData["style"],
				text: "hi",
			} as Partial<ShapeData>,
		]);
		const items = cloneSeedItems(s as BoardStore, "seed", 3);
		expect(items).toHaveLength(3);
		for (const it of items) {
			expect(it.kind).toBe("new");
			if (it.kind !== "new") continue;
			expect(it.spec.type).toBe("sticky");
			expect(it.spec.width).toBe(100);
			expect(it.spec.height).toBe(80);
			expect(it.spec.text).toBe("hi"); // intrinsic field carried
			expect(it.spec.id).toBeUndefined();
			expect(it.spec.x).toBeUndefined();
			expect(it.spec.parentId).toBeUndefined();
			// store-managed fields must NOT be cloned (fresh values from the store)
			expect(it.spec.zIndex).toBeUndefined();
			expect(it.spec.createdAt).toBeUndefined();
		}
	});

	it("returns [] for a missing seed or count <= 0", () => {
		const s = store([{ id: "a", type: "rect", x: 0, y: 0, width: 10, height: 10 }]);
		expect(cloneSeedItems(s as BoardStore, "nope", 3)).toEqual([]);
		expect(cloneSeedItems(s as BoardStore, "a", 0)).toEqual([]);
	});
});
