import type { PluginContext, Point, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { findShapeAtPoint } from "./find-shape-at-point.js";

const shape = (
	id: string,
	type: string,
	extra: Partial<ShapeData> = {},
	x = 0,
	y = 0,
	width = 100,
	height = 100,
): ShapeData => ({ id, type, x, y, width, height, rotation: 0, ...extra }) as ShapeData;

const inBounds = (s: ShapeData, p: Point) =>
	p.x >= s.x && p.x <= s.x + s.width && p.y >= s.y && p.y <= s.y + s.height;

/** `shapes` は挿入順、`sorted` は zIndex 順（省略時は挿入順と同じ） */
function ctx(shapes: ShapeData[], sorted: ShapeData[] = shapes) {
	return {
		store: {
			getShapes: () => new Map(shapes.map((s) => [s.id, s])),
			getShapesSorted: () => sorted,
		},
		shapes: { get: () => ({ hitTest: inBounds }) },
	} as unknown as PluginContext;
}

const P = { x: 50, y: 50 };

describe("findShapeAtPoint (connector anchor target)", () => {
	it("挿入順ではなく zIndex 順で最前面の図形を返す", () => {
		const a = shape("a", "rect");
		const b = shape("b", "rect");
		// 挿入順は a → b だが、a を最前面に移動済み
		expect(findShapeAtPoint(ctx([a, b], [b, a]), P)?.id).toBe("a");
	});

	it("connector / domain-connector は対象外", () => {
		const c = ctx([shape("r", "rect"), shape("c", "connector"), shape("d", "domain-connector")]);
		expect(findShapeAtPoint(c, P)?.id).toBe("r");
	});

	it("非表示・ロック中の図形と、その子は対象外", () => {
		const c = ctx([
			shape("below", "rect"),
			shape("hidden", "rect", { hidden: true }),
			shape("locked", "rect", { locked: true }),
			shape("lockedFrame", "frame", { locked: true }),
			shape("child", "rect", { parentId: "lockedFrame" }),
		]);
		expect(findShapeAtPoint(c, P)?.id).toBe("below");
	});

	it("frame / group より中の図形を優先し、他に無ければコンテナを返す", () => {
		const frame = shape("f", "frame");
		const child = shape("child", "rect", {}, 10, 10, 20, 20);
		expect(findShapeAtPoint(ctx([child, frame]), { x: 15, y: 15 })?.id).toBe("child");
		expect(findShapeAtPoint(ctx([child, frame]), P)?.id).toBe("f");
	});
});
