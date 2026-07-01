import { overlapsAny } from "@edv4h/usketch-shape-utils";
import type { BoundingBox, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createFreePositionPlugin, type FreePositionRequest } from "../plugin.js";

const style = { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 };

function shape(id: string, x: number, y: number, w = 100, h = 80, rotation?: number): ShapeData {
	return { id, type: "rectangle", x, y, width: w, height: h, style, rotation };
}

/** findFreePosition が参照する最小限の PluginContext スタブ。 */
function makeCtx(shapes: ShapeData[]) {
	const map = new Map(shapes.map((s) => [s.id, s] as const));
	const handlers = new Map<string, ((data: unknown) => void)[]>();
	const ctx = {
		store: { getShapes: () => map },
		shapes: {
			get: (_type: string) => ({
				getBounds: (s: ShapeData): BoundingBox => ({
					x: s.x,
					y: s.y,
					width: s.width,
					height: s.height,
				}),
			}),
		},
		events: {
			on: (e: string, h: (data: unknown) => void) => {
				const list = handlers.get(e) ?? [];
				list.push(h);
				handlers.set(e, list);
				return () => {};
			},
			emit: (e: string, data: unknown) => {
				for (const h of handlers.get(e) ?? []) h(data);
			},
		},
	} as unknown as PluginContext;
	const emitFind = (req: Omit<FreePositionRequest, "onResult">): BoundingBox => {
		let result: BoundingBox | null = null;
		ctx.events.emit("free-position:find", {
			...req,
			onResult: (b) => {
				result = b;
			},
		});
		if (!result) throw new Error("no result");
		return result;
	};
	return { ctx, emitFind };
}

describe("createFreePositionPlugin", () => {
	it("free-position:find が被らない位置を返す", () => {
		const { ctx, emitFind } = makeCtx([shape("a", 0, 0)]);
		createFreePositionPlugin().setup(ctx);
		const free = emitFind({ desired: { x: 0, y: 0, width: 100, height: 80 } });
		expect(overlapsAny(free, [{ x: 0, y: 0, width: 100, height: 80 }])).toBe(false);
	});

	it("excludeIds の shape は避けない（自身を除外）", () => {
		const { ctx, emitFind } = makeCtx([shape("a", 0, 0)]);
		createFreePositionPlugin().setup(ctx);
		const free = emitFind({ desired: { x: 0, y: 0, width: 100, height: 80 }, excludeIds: ["a"] });
		// "a" を除外したので occupied 空 → desired のまま
		expect(free).toEqual({ x: 0, y: 0, width: 100, height: 80 });
	});

	it("回転 shape は回転後 AABB で避ける", () => {
		// 100x80 を 45° 回転 → AABB は約 127x127 に広がる。desired(110,0) は素の bbox(100x80)とは
		// 重ならないが、回転後 AABB(中心50,40・約127角)とは重なる → ずれる。
		const { ctx, emitFind } = makeCtx([shape("a", 0, 0, 100, 80, 45)]);
		createFreePositionPlugin({ strategy: "push" }).setup(ctx);
		const desired = { x: 110, y: 0, width: 20, height: 20 };
		const free = emitFind({ desired });
		expect(free).not.toEqual(desired); // 回転後 AABB を避けて移動した
	});

	it("config の strategy 既定とリクエスト上書きが効く", () => {
		const { ctx, emitFind } = makeCtx([shape("a", 0, 0)]);
		createFreePositionPlugin({ strategy: "push" }).setup(ctx);
		const free = emitFind({ desired: { x: 80, y: 0, width: 100, height: 80 }, strategy: "push" });
		expect(free.y).toBe(0); // push: x 軸へ押し出し
		expect(overlapsAny(free, [{ x: 0, y: 0, width: 100, height: 80 }])).toBe(false);
	});
});
