import type { ShapeData, ShapeDefinition, ToolContext } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { createDropTargetFinder, findDropTarget } from "./drop-target.js";

const shape = (id: string, type: string, x = 0, y = 0, width = 100, height = 100): ShapeData =>
	({ id, type, x, y, width, height, rotation: 0 }) as ShapeData;

const def = (container?: ShapeDefinition["container"]): ShapeDefinition =>
	({
		getBounds: (s: ShapeData) => ({ x: s.x, y: s.y, width: s.width, height: s.height }),
		container,
	}) as unknown as ShapeDefinition;

const defs: Record<string, ShapeDefinition> = {
	frame: def({ selectableChildren: true, autoAttach: true }),
	group: def({}),
	"voice-frame": def({ selectableChildren: true, autoAttach: false }),
	rect: def(),
};

function ctx(shapes: ShapeData[]) {
	const map = new Map(shapes.map((s) => [s.id, s]));
	return {
		store: { getShapes: () => map, getShape: (id: string) => map.get(id) },
		shapes: { get: (type: string) => defs[type] },
		map,
	} as unknown as Pick<ToolContext, "store" | "shapes"> & { map: Map<string, ShapeData> };
}

describe("findDropTarget", () => {
	it("カーソル下の autoAttach コンテナ（frame）を返す", () => {
		expect(findDropTarget(ctx([shape("f", "frame")]), { x: 50, y: 50 }, new Set())).toBe("f");
	});

	it("autoAttach でないコンテナ（group / voice-frame）や通常図形は対象外", () => {
		const c = ctx([shape("g", "group"), shape("v", "voice-frame"), shape("r", "rect")]);
		expect(findDropTarget(c, { x: 50, y: 50 }, new Set())).toBeNull();
	});

	it("範囲外やドラッグ中の図形は対象外", () => {
		const c = ctx([shape("f", "frame")]);
		expect(findDropTarget(c, { x: 150, y: 50 }, new Set())).toBeNull();
		expect(findDropTarget(c, { x: 50, y: 50 }, new Set(["f"]))).toBeNull();
	});

	it("重なっている場合は前面（後に並ぶ）のものを返す", () => {
		const c = ctx([shape("back", "frame"), shape("front", "frame", 20, 20)]);
		expect(findDropTarget(c, { x: 50, y: 50 }, new Set())).toBe("front");
		expect(findDropTarget(c, { x: 10, y: 10 }, new Set())).toBe("back");
	});

	it("container.autoAttach の関数形式をインスタンスごとに評価する", () => {
		defs.dynamic = def({ autoAttach: (s) => s.id === "yes" });
		const c = ctx([shape("yes", "dynamic"), shape("no", "dynamic", 200, 0)]);
		expect(findDropTarget(c, { x: 50, y: 50 }, new Set())).toBe("yes");
		expect(findDropTarget(c, { x: 250, y: 50 }, new Set())).toBeNull();
	});

	describe("createDropTargetFinder（1 回のドラッグ用）", () => {
		it("最初の判定でコンテナを集め、以降のポインタ移動では全図形を走査しない", () => {
			const c = ctx([shape("r", "rect"), shape("f", "frame")]);
			let walks = 0;
			const getShapes = c.store.getShapes;
			c.store.getShapes = () => {
				walks++;
				return getShapes();
			};
			const find = createDropTargetFinder(c, new Set());
			expect(find({ x: 50, y: 50 })).toBe("f");
			expect(find({ x: 150, y: 50 })).toBeNull();
			expect(find({ x: 10, y: 10 })).toBe("f");
			expect(walks).toBe(1);
		});

		it("ドラッグ中にコンテナが動いた・消えた・autoAttach でなくなったら今の状態で判定する", () => {
			const c = ctx([shape("back", "frame"), shape("front", "frame", 20, 20)]);
			const find = createDropTargetFinder(c, new Set());
			expect(find({ x: 50, y: 50 })).toBe("front");
			c.map.set("front", shape("front", "frame", 500, 500));
			expect(find({ x: 50, y: 50 })).toBe("back");
			expect(find({ x: 550, y: 550 })).toBe("front");
			c.map.set("front", shape("front", "group", 500, 500));
			expect(find({ x: 550, y: 550 })).toBeNull();
			c.map.delete("back");
			expect(find({ x: 50, y: 50 })).toBeNull();
		});

		it("ドラッグ中の図形（excludeIds）は対象外", () => {
			const c = ctx([shape("back", "frame"), shape("front", "frame", 20, 20)]);
			expect(createDropTargetFinder(c, new Set(["front"]))({ x: 50, y: 50 })).toBe("back");
		});
	});
});
