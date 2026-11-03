import type { Point, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { findShapeAtPoint } from "../hit-test.js";

const shape = (id: string, extra: Partial<ShapeData> = {}): ShapeData =>
	({ id, type: "rect", x: 0, y: 0, width: 100, height: 100, ...extra }) as ShapeData;

const inBounds = (s: ShapeData, p: Point) =>
	p.x >= s.x && p.x <= s.x + s.width && p.y >= s.y && p.y <= s.y + s.height;

const shapes = { get: () => ({ hitTest: inBounds }) };
const P = { x: 50, y: 50 };

describe("findShapeAtPoint", () => {
	it("getShapesSorted が無いストアでは挿入順の最後（最前面）から探す", () => {
		const map = new Map([shape("a"), shape("b")].map((s) => [s.id, s]));
		expect(findShapeAtPoint({ store: { getShapes: () => map }, shapes }, P)?.id).toBe("b");
	});

	it("getShapesSorted の配列を書き換えない", () => {
		const sorted = [shape("a"), shape("b")];
		const map = new Map(sorted.map((s) => [s.id, s]));
		const ctx = { store: { getShapes: () => map, getShapesSorted: () => sorted }, shapes };
		expect(findShapeAtPoint(ctx, P)?.id).toBe("b");
		expect(sorted.map((s) => s.id)).toEqual(["a", "b"]);
	});

	it("当たった図形の親が非表示なら、その下の図形を返す", () => {
		const sorted = [
			shape("below"),
			shape("parent", { hidden: true, x: 500 }),
			shape("child", { parentId: "parent" }),
		];
		const map = new Map(sorted.map((s) => [s.id, s]));
		const ctx = { store: { getShapes: () => map, getShapesSorted: () => sorted }, shapes };
		expect(findShapeAtPoint(ctx, P)?.id).toBe("below");
	});
});
