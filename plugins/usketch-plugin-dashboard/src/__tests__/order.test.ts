import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import type { GridSpec } from "../grid.js";
import { readingOrder } from "../order.js";

const spec: GridSpec = {
	columns: 3,
	cellW: 100,
	cellH: 80,
	gap: 10,
	padding: 20,
	originX: 0,
	originY: 0,
};

function shape(id: string, x: number, y: number): ShapeData {
	return {
		id,
		type: "rectangle",
		x,
		y,
		width: 100,
		height: 80,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	};
}

describe("readingOrder", () => {
	it("row-major（上→下、次に左→右）で並べる", () => {
		// 2 行 x 3 列を意図的にシャッフルして渡す
		const items = [
			shape("d", 20, 110), // row1 col0
			shape("b", 130, 20), // row0 col1
			shape("f", 240, 110), // row1 col2
			shape("a", 20, 20), // row0 col0
			shape("e", 130, 110), // row1 col1
			shape("c", 240, 20), // row0 col2
		];
		expect(readingOrder(items, spec)).toEqual(["a", "b", "c", "d", "e", "f"]);
	});

	it("サブセルの揺れ（少しズレた位置）でも同じ行にまとめる", () => {
		const items = [
			shape("a", 22, 18), // 少しズレても row0
			shape("b", 128, 25), // row0
			shape("c", 18, 112), // row1
		];
		expect(readingOrder(items, spec)).toEqual(["a", "b", "c"]);
	});

	it("完全に同じ位置のタイは入力順で安定", () => {
		const items = [shape("x", 20, 20), shape("y", 20, 20)];
		expect(readingOrder(items, spec)).toEqual(["x", "y"]);
		// 入力順を反転すると結果も反転する（座標が同一なので .i が唯一の決定要因）
		const reversed = [shape("y", 20, 20), shape("x", 20, 20)];
		expect(readingOrder(reversed, spec)).toEqual(["y", "x"]);
	});
});
