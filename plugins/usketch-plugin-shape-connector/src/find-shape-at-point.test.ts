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

/** `container` を宣言している図形タイプ（frame / group と同じ扱いになるもの） */
const CONTAINER_TYPES = new Set(["frame", "group", "voice-frame"]);

/** `shapes` は挿入順、`sorted` は zIndex 順（省略時は挿入順と同じ） */
function ctx(shapes: ShapeData[], sorted: ShapeData[] = shapes) {
	return {
		store: {
			getShapes: () => new Map(shapes.map((s) => [s.id, s])),
			getShapesSorted: () => sorted,
		},
		shapes: {
			get: (type: string) => ({
				hitTest: inBounds,
				...(CONTAINER_TYPES.has(type) ? { container: {} } : {}),
			}),
		},
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

	it("コンテナ判定は図形タイプ名ではなく ShapeDefinition の container 宣言で行う", () => {
		const child = shape("child", "rect", {}, 10, 10, 20, 20);
		// frame / group 以外でも container を宣言していればコンテナ扱い
		const voiceFrame = shape("vf", "voice-frame");
		expect(findShapeAtPoint(ctx([child, voiceFrame]), { x: 15, y: 15 })?.id).toBe("child");
		expect(findShapeAtPoint(ctx([child, voiceFrame]), P)?.id).toBe("vf");
		// container を宣言していない図形は前面にあればそのまま返す
		const plain = shape("p", "rect");
		expect(findShapeAtPoint(ctx([child, plain]), { x: 15, y: 15 })?.id).toBe("p");
	});

	it("container.enabled が false を返すインスタンスはコンテナ扱いしない", () => {
		const child = shape("child", "rect", {}, 10, 10, 20, 20);
		const wf = shape("wf", "panel", { meta: { component: "button" } } as Partial<ShapeData>);
		const c = {
			...ctx([child, wf]),
			shapes: {
				get: (type: string) => ({
					hitTest: inBounds,
					...(type === "panel"
						? { container: { enabled: (d: ShapeData) => d.meta?.component === "card" } }
						: {}),
				}),
			},
		} as unknown as PluginContext;
		expect(findShapeAtPoint(c, { x: 15, y: 15 })?.id).toBe("wf");
	});
});
