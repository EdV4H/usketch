import { describe, expect, it } from "vitest";
import {
	cellTopLeft,
	cellXY,
	type GridSpec,
	type ItemSize,
	type PlacedBox,
	packAbsolute,
	packSpans,
	spanOf,
	targetIndexFromPoint,
} from "../grid.js";

const spec: GridSpec = {
	columns: 3,
	cellW: 100,
	cellH: 80,
	gap: 10,
	padding: 20,
	originX: 0,
	originY: 0,
};

const item = (id: string, width: number, height: number): ItemSize => ({ id, width, height });

describe("cellXY / cellTopLeft", () => {
	it("gird 座標 (col,row) → world top-left（gap/padding/origin 反映）", () => {
		expect(cellXY(0, 0, spec)).toEqual({ x: 20, y: 20 });
		expect(cellXY(1, 0, spec)).toEqual({ x: 130, y: 20 }); // +（100+10）
		expect(cellXY(0, 1, spec)).toEqual({ x: 20, y: 110 }); // +（80+10）
	});

	it("cellTopLeft は行 major の線形 index を col/row に展開", () => {
		expect(cellTopLeft(0, spec)).toEqual({ x: 20, y: 20 });
		expect(cellTopLeft(3, spec)).toEqual({ x: 20, y: 110 }); // 3 列で wrap
		expect(cellTopLeft(4, spec)).toEqual({ x: 130, y: 110 });
	});
});

describe("spanOf", () => {
	it("1 セルに収まるサイズは 1x1", () => {
		expect(spanOf(100, 80, spec)).toEqual({ cols: 1, rows: 1 });
		expect(spanOf(50, 50, spec)).toEqual({ cols: 1, rows: 1 });
	});

	it("セルを超えるサイズは必要セル数に切り上げ", () => {
		// 幅 210 → (210+10)/(100+10)=2 → 2 列
		expect(spanOf(210, 80, spec).cols).toBe(2);
		// 高さ 170 → (170+10)/(80+10)=2 → 2 行
		expect(spanOf(100, 170, spec).rows).toBe(2);
	});

	it("列 span は columns にクランプ、行 span は無制限", () => {
		expect(spanOf(9999, 9999, spec).cols).toBe(3); // columns=3
		expect(spanOf(9999, 9999, spec).rows).toBeGreaterThan(3);
	});
});

describe("packSpans", () => {
	it("全て 1x1 なら 1 セル/1 アイテムで行 major に流す", () => {
		const out = packSpans(
			[item("a", 100, 80), item("b", 100, 80), item("c", 100, 80), item("d", 100, 80)],
			spec,
		);
		expect(out).toEqual([
			{ id: "a", x: 20, y: 20 },
			{ id: "b", x: 130, y: 20 },
			{ id: "c", x: 240, y: 20 },
			{ id: "d", x: 20, y: 110 }, // 3 列で wrap
		]);
	});

	it("幅広アイテムは複数セルをまたぎ、後続がその周りに流れる", () => {
		// A=1col, B=2col, C/D/E=1col（プレビュー相当、3 列）
		const out = packSpans(
			[
				item("A", 100, 80),
				item("B", 210, 80),
				item("C", 100, 80),
				item("D", 100, 80),
				item("E", 100, 80),
			],
			spec,
		);
		const at = (id: string) => out.find((p) => p.id === id);
		expect(at("A")).toMatchObject({ x: 20, y: 20 }); // row0 col0
		expect(at("B")).toMatchObject({ x: 130, y: 20 }); // row0 col1-2（2セル幅）
		// row0 は埋まったので C,D,E は row1 へ
		expect(at("C")).toMatchObject({ x: 20, y: 110 }); // row1 col0
		expect(at("D")).toMatchObject({ x: 130, y: 110 }); // row1 col1
		expect(at("E")).toMatchObject({ x: 240, y: 110 }); // row1 col2
	});

	it("背の高いアイテムは下のセルも占有し、後続は重ならない", () => {
		// A=1x2（縦2セル）, B,C 1x1
		const out = packSpans([item("A", 100, 170), item("B", 100, 80), item("C", 100, 80)], spec);
		const at = (id: string) => out.find((p) => p.id === id);
		expect(at("A")).toMatchObject({ x: 20, y: 20 }); // row0-1, col0
		expect(at("B")).toMatchObject({ x: 130, y: 20 }); // row0 col1
		expect(at("C")).toMatchObject({ x: 240, y: 20 }); // row0 col2
		// A が (row1,col0) を占有しているので、その位置には誰も来ない
		expect(out.every((p) => !(p.id !== "A" && p.x === 20 && p.y === 110))).toBe(true);
	});
});

describe("packAbsolute", () => {
	const box = (id: string, x: number, y: number, width = 100, height = 80): PlacedBox => ({
		id,
		x,
		y,
		width,
		height,
	});

	it("各アイテムを自分の位置に最も近いセルへスナップし、隙間は保持する", () => {
		// A は cell(0,0) 付近、B は cell(2,0) 付近（col1 は空きのまま）
		const out = packAbsolute([box("A", 25, 22), box("B", 250, 22)], spec);
		expect(out).toEqual([
			{ id: "A", x: 20, y: 20 }, // cell(0,0)
			{ id: "B", x: 240, y: 20 }, // cell(2,0) — col1 は空き（詰めない）
		]);
	});

	it("同じセルを望むと先着優先、後発は前方の空きセルへ", () => {
		const out = packAbsolute([box("A", 25, 22), box("C", 25, 22)], spec);
		expect(out.find((p) => p.id === "A")).toEqual({ id: "A", x: 20, y: 20 }); // cell(0,0)
		expect(out.find((p) => p.id === "C")).toEqual({ id: "C", x: 130, y: 20 }); // cell(1,0)
	});
});

describe("targetIndexFromPoint", () => {
	const boxes: PlacedBox[] = [
		{ id: "a", x: 20, y: 20, width: 100, height: 80 }, // center (70,60) band0
		{ id: "b", x: 130, y: 20, width: 100, height: 80 }, // center (180,60) band0
		{ id: "c", x: 20, y: 110, width: 100, height: 80 }, // center (70,150) band1
	];

	it("同じ行で左のアイテムより右にある点はその後ろへ", () => {
		// a と b の間（x=125, band0）
		expect(targetIndexFromPoint({ x: 125, y: 60 }, boxes, spec)).toBe(1);
	});

	it("先頭より前は 0", () => {
		expect(targetIndexFromPoint({ x: 0, y: 60 }, boxes, spec)).toBe(0);
	});

	it("最終行の後ろは末尾 index", () => {
		expect(targetIndexFromPoint({ x: 999, y: 150 }, boxes, spec)).toBe(3);
	});
});
