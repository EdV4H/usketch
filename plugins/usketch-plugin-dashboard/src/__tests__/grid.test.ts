import { describe, expect, it } from "vitest";
import { cellTopLeft, type GridSpec, indexFromPoint, packGrid, packGridWithGap } from "../grid.js";

const spec: GridSpec = {
	columns: 3,
	cellW: 100,
	cellH: 80,
	gap: 10,
	padding: 20,
	originX: 0,
	originY: 0,
};

describe("cellTopLeft", () => {
	it("行列を row-major に並べ、gap/padding/origin を反映する", () => {
		expect(cellTopLeft(0, spec)).toEqual({ x: 20, y: 20 });
		// col 1: x = 20 + 1*(100+10)
		expect(cellTopLeft(1, spec)).toEqual({ x: 130, y: 20 });
		// col 2
		expect(cellTopLeft(2, spec)).toEqual({ x: 240, y: 20 });
		// wraps to row 1, col 0: y = 20 + 1*(80+10)
		expect(cellTopLeft(3, spec)).toEqual({ x: 20, y: 110 });
		expect(cellTopLeft(4, spec)).toEqual({ x: 130, y: 110 });
	});

	it("origin をずらすと全セルが平行移動する", () => {
		const shifted: GridSpec = { ...spec, originX: 1000, originY: 500 };
		expect(cellTopLeft(0, shifted)).toEqual({ x: 1020, y: 520 });
		expect(cellTopLeft(4, shifted)).toEqual({ x: 1130, y: 610 });
	});
});

describe("packGrid", () => {
	it("アイテムを順にセルへスナップする", () => {
		expect(packGrid(["a", "b", "c", "d"], spec)).toEqual([
			{ id: "a", x: 20, y: 20 },
			{ id: "b", x: 130, y: 20 },
			{ id: "c", x: 240, y: 20 },
			{ id: "d", x: 20, y: 110 },
		]);
	});

	it("空配列は空を返す", () => {
		expect(packGrid([], spec)).toEqual([]);
	});
});

describe("packGridWithGap", () => {
	it("dragged を除外し targetIndex のセルを空ける", () => {
		const out = packGridWithGap(["a", "b", "c", "d"], "b", 1, spec);
		// b は除外、cell 1 は空く: a→0, c→2, d→3
		expect(out).toEqual([
			{ id: "a", x: 20, y: 20 },
			{ id: "c", x: 240, y: 20 },
			{ id: "d", x: 20, y: 110 },
		]);
	});

	it("targetIndex=0 で先頭を空ける", () => {
		const out = packGridWithGap(["a", "b", "c"], "a", 0, spec);
		// a 除外、cell0 空く: b→1, c→2
		expect(out).toEqual([
			{ id: "b", x: 130, y: 20 },
			{ id: "c", x: 240, y: 20 },
		]);
	});

	it("末尾を超える targetIndex は末尾スロットにクランプされる", () => {
		const out = packGridWithGap(["a", "b", "c"], "b", 99, spec);
		// others=[a,c], gapAt=2 (>len) → a→0, c→1（隙間は末尾に）
		expect(out).toEqual([
			{ id: "a", x: 20, y: 20 },
			{ id: "c", x: 130, y: 20 },
		]);
	});
});

describe("indexFromPoint", () => {
	it("cellTopLeft の逆（セル中心→そのセルの index）", () => {
		// cell 1 の中心
		const c1 = cellTopLeft(1, spec);
		const center = { x: c1.x + spec.cellW / 2, y: c1.y + spec.cellH / 2 };
		expect(indexFromPoint(center, spec, 6)).toBe(1);
		// cell 4 の中心 (row 1, col 1)
		const c4 = cellTopLeft(4, spec);
		const center4 = { x: c4.x + spec.cellW / 2, y: c4.y + spec.cellH / 2 };
		expect(indexFromPoint(center4, spec, 6)).toBe(4);
	});

	it("count でクランプ（末尾に挿入可能）", () => {
		const far = { x: 100000, y: 100000 };
		expect(indexFromPoint(far, spec, 5)).toBe(5);
	});

	it("原点より手前は 0 にクランプ", () => {
		expect(indexFromPoint({ x: -500, y: -500 }, spec, 5)).toBe(0);
	});

	it("列は columns-1 でクランプ（右端を超えても行送りしない）", () => {
		// 遠い x でも同じ行内では最終列に留まる
		const idx = indexFromPoint({ x: 100000, y: 40 }, spec, 100);
		expect(idx).toBe(2); // row 0, col 2
	});
});
