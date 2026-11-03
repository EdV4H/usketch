import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import {
	collectObstacles,
	DISPLACER_META_KEY,
	isLiquidDisplacer,
	setLiquidDisplacer,
	toggleLiquidDisplacer,
} from "../displacer.js";

const style = { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 };

function shape(id: string, extra: Partial<ShapeData> = {}): ShapeData {
	return { id, type: "rectangle", x: 0, y: 0, width: 100, height: 50, style, ...extra };
}

function fakeStore(shapes: ShapeData[]): BoardStore {
	const map = new Map(shapes.map((s) => [s.id, s]));
	return {
		getShape: (id: string) => map.get(id),
		updateShape: (id: string, updates: Partial<ShapeData>) => {
			const s = map.get(id);
			if (s) map.set(id, { ...s, ...updates });
		},
	} as unknown as BoardStore;
}

const world = { x: -1000, y: -1000, width: 2000, height: 2000 };

describe("displacer flag", () => {
	it("set / toggle は meta のフラグを付け外しし、他の meta は保つ", () => {
		const store = fakeStore([shape("a", { meta: { keep: 1 } }), shape("b")]);
		setLiquidDisplacer(store, ["a"], true);
		expect(store.getShape("a")?.meta).toEqual({ keep: 1, [DISPLACER_META_KEY]: true });

		// Mixed → all on.
		expect(toggleLiquidDisplacer(store, ["a", "b"])).toBe(true);
		expect(isLiquidDisplacer(store.getShape("b") as ShapeData)).toBe(true);
		// All on → all off.
		expect(toggleLiquidDisplacer(store, ["a", "b"])).toBe(false);
		expect(store.getShape("a")?.meta).toEqual({ keep: 1 });
	});
});

describe("collectObstacles", () => {
	it("marked モードはフラグ付きシェイプだけを障害物にする", () => {
		const shapes = [shape("a", { meta: { [DISPLACER_META_KEY]: true } }), shape("b")];
		expect(collectObstacles(shapes, "marked", world, 0)).toHaveLength(1);
		expect(collectObstacles(shapes, "all", world, 0)).toHaveLength(2);
	});

	it("中心・半径・回転・楕円を変換し、非表示と範囲外は除く", () => {
		const shapes = [
			shape("e", { type: "ellipse", x: 10, y: 20, rotation: 90 }),
			shape("h", { hidden: true }),
			shape("far", { x: 5000 }),
		];
		const [o, ...rest] = collectObstacles(shapes, "all", world, 4);
		expect(rest).toHaveLength(0);
		expect(o).toMatchObject({ cx: 60, cy: 45, hw: 54, hh: 29, kind: "ellipse" });
		expect(o.rotation).toBeCloseTo(Math.PI / 2);
	});
});
