import type { ShapeData, ShapeDefinition, ShapeRegistry } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { applyItemPatches } from "../move-items.js";

function shape(
	id: string,
	x: number,
	y: number,
	extra: Partial<ShapeData> & { type?: string } = {},
): ShapeData {
	return {
		id,
		type: "rectangle",
		x,
		y,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...extra,
	};
}

/** Just enough of a registry: `get` by type. frame/group are containers, `sticker`
 *  is an attachable that follows, `pin` an attachable that opts out. */
function registry(extra: Record<string, Partial<ShapeDefinition>> = {}): ShapeRegistry {
	const defs: Record<string, Partial<ShapeDefinition>> = {
		frame: { container: {} },
		group: { container: {} },
		rectangle: {},
		sticker: { attachable: {} },
		pin: { attachable: { follow: false } },
		...extra,
	};
	return { get: (type: string) => defs[type] as ShapeDefinition | undefined } as ShapeRegistry;
}

const pos = (store: ReturnType<typeof createBoardStore>, id: string) => {
	const s = store.getShape(id);
	return s ? { x: s.x, y: s.y } : null;
};

describe("applyItemPatches — 親を動かすと子も同じだけ動く", () => {
	it("frame を動かすと子と孫が相対位置を保ってついてくる", () => {
		const store = createBoardStore();
		store.addShape(shape("f", 400, 0, { type: "frame" }));
		store.addShape(shape("g", 410, 10, { type: "group", parentId: "f" }));
		store.addShape(shape("c", 420, 20, { width: 20, height: 20, parentId: "g" }));

		applyItemPatches(store, registry(), [{ id: "f", patch: { x: 100, y: 50 } }]);

		expect(pos(store, "f")).toEqual({ x: 100, y: 50 });
		expect(pos(store, "g")).toEqual({ x: 110, y: 60 });
		expect(pos(store, "c")).toEqual({ x: 120, y: 70 });
	});

	it("group が子の移動ごとに外接矩形を取り直しても、最後は group も子も正しい位置に揃う", () => {
		const store = createBoardStore();
		store.addShape(shape("g", 400, 0, { type: "group", width: 120, height: 120 }));
		store.addShape(shape("c1", 400, 0, { width: 20, height: 20, parentId: "g" }));
		store.addShape(shape("c2", 500, 100, { width: 20, height: 20, parentId: "g" }));
		// usketch-plugin-shape-group と同じ: 子が動くたびに親 group を子の外接矩形へ合わせる
		store.onMutation((event) => {
			if (event.type !== "shape:updated") return;
			const s = store.getShape(event.payload.id);
			const parent = s?.parentId ? store.getShape(s.parentId) : undefined;
			if (parent?.type !== "group") return;
			const kids = [...store.getShapes().values()].filter((k) => k.parentId === parent.id);
			const x = Math.min(...kids.map((k) => k.x));
			const y = Math.min(...kids.map((k) => k.y));
			const width = Math.max(...kids.map((k) => k.x + k.width)) - x;
			const height = Math.max(...kids.map((k) => k.y + k.height)) - y;
			if (parent.x === x && parent.y === y && parent.width === width && parent.height === height)
				return;
			store.updateShape(parent.id, { x, y, width, height });
		});

		applyItemPatches(store, registry(), [{ id: "g", patch: { x: 0, y: 200 } }]);

		expect(pos(store, "g")).toEqual({ x: 0, y: 200 });
		expect(store.getShape("g")?.width).toBe(120);
		expect(pos(store, "c1")).toEqual({ x: 0, y: 200 });
		expect(pos(store, "c2")).toEqual({ x: 100, y: 300 });
	});

	it("サイズだけのパッチでは子を動かさない", () => {
		const store = createBoardStore();
		store.addShape(shape("f", 0, 0, { type: "frame" }));
		store.addShape(shape("c", 10, 10, { parentId: "f" }));

		applyItemPatches(store, registry(), [{ id: "f", patch: { width: 300 } }]);

		expect(store.getShape("f")?.width).toBe(300);
		expect(pos(store, "c")).toEqual({ x: 10, y: 10 });
	});

	it("ドラッグと同じルール: コンテナでない親の子は attachable.follow のときだけついてくる", () => {
		const store = createBoardStore();
		store.addShape(shape("r", 0, 0));
		store.addShape(shape("s", 10, 10, { type: "sticker", parentId: "r" }));
		store.addShape(shape("p", 20, 20, { type: "pin", parentId: "r" }));
		store.addShape(shape("plain", 30, 30, { parentId: "r" }));

		applyItemPatches(store, registry(), [{ id: "r", patch: { x: 100, y: 0 } }]);

		expect(pos(store, "s")).toEqual({ x: 110, y: 10 });
		expect(pos(store, "p")).toEqual({ x: 20, y: 20 });
		expect(pos(store, "plain")).toEqual({ x: 30, y: 30 });
	});

	it("レジストリが無いときは子をすべて動かす（置き去りにしない）", () => {
		const store = createBoardStore();
		store.addShape(shape("r", 0, 0));
		store.addShape(shape("c", 10, 10, { parentId: "r" }));

		applyItemPatches(store, undefined, [{ id: "r", patch: { x: 0, y: 200 } }]);

		expect(pos(store, "c")).toEqual({ x: 10, y: 210 });
	});

	it("子の ShapeDefinition.move があればそれで平行移動する", () => {
		const store = createBoardStore();
		store.addShape(shape("f", 0, 0, { type: "frame" }));
		store.addShape(shape("m", 10, 10, { type: "moved", parentId: "f" }));
		const reg = registry({
			moved: {
				move: (s: ShapeData, dx: number, dy: number) => ({
					x: s.x + dx,
					y: s.y + dy,
					width: s.width + 1, // marker: proves the hook ran
				}),
			},
		});

		applyItemPatches(store, reg, [{ id: "f", patch: { x: 50, y: 0 } }]);

		expect(pos(store, "m")).toEqual({ x: 60, y: 10 });
		expect(store.getShape("m")?.width).toBe(101);
	});

	it("差分で動かすので、行き（execute）と戻り（undo）の両方で子が正しい位置に来る", () => {
		const store = createBoardStore();
		store.addShape(shape("f", 400, 0, { type: "frame" }));
		store.addShape(shape("c", 430, 40, { parentId: "f" }));

		applyItemPatches(store, registry(), [{ id: "f", patch: { x: 0, y: 0 } }]);
		expect(pos(store, "c")).toEqual({ x: 30, y: 40 });
		applyItemPatches(store, registry(), [{ id: "f", patch: { x: 400, y: 0 } }]);
		expect(pos(store, "c")).toEqual({ x: 430, y: 40 });
	});
});
