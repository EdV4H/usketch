import type { ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { gridSpecFromConfig } from "../config-ops.js";
import { makeDashboardConfig } from "../dashboard-config-shape.js";
import { allDashboardItems, dashboardItems, isDashboardItem, isWithinGrid } from "../items.js";

function rect(overrides: Partial<ShapeData> = {}): ShapeData {
	return {
		id: overrides.id ?? "s1",
		type: overrides.type ?? "rectangle",
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
		...overrides,
	};
}

describe("isDashboardItem", () => {
	it("トップレベルの通常 Shape はアイテム", () => {
		const store = createBoardStore();
		const s = rect({ id: "a" });
		store.addShape(s);
		expect(isDashboardItem(store, s)).toBe(true);
	});

	it("ネストした子 Shape はアイテムに含めない（親の add/remove で全体リフローさせない）", () => {
		const store = createBoardStore();
		const parent = rect({ id: "g", type: "group" });
		const child = rect({ id: "c", parentId: "g" });
		store.addShape(parent);
		store.addShape(child);
		expect(isDashboardItem(store, child)).toBe(false);
		// group 自体はトップレベルなのでアイテム
		expect(isDashboardItem(store, parent)).toBe(true);
	});

	it("config シングルトン・locked・hidden・面積0 は除外", () => {
		const store = createBoardStore();
		const config = makeDashboardConfig();
		store.addShape(config);
		expect(isDashboardItem(store, config)).toBe(false);
		expect(isDashboardItem(store, rect({ id: "l", locked: true }))).toBe(false);
		expect(isDashboardItem(store, rect({ id: "z", width: 0 }))).toBe(false);
	});
});

describe("dashboardItems", () => {
	it("トップレベルのアイテムのみを列挙し、config と子は除外する", () => {
		const store = createBoardStore();
		store.addShape(makeDashboardConfig());
		store.addShape(rect({ id: "a" }));
		store.addShape(rect({ id: "g", type: "group" }));
		store.addShape(rect({ id: "c", parentId: "g" }));
		expect(
			dashboardItems(store)
				.map((s) => s.id)
				.sort(),
		).toEqual(["a", "g"]);
	});
});

describe("grid range (out-of-range = free)", () => {
	const config = makeDashboardConfig({
		columns: 4,
		cellW: 100,
		cellH: 100,
		gap: 0,
		padding: 0,
		originX: 0,
		originY: 0,
	});
	const spec = gridSpecFromConfig(config);

	it("isWithinGrid: 列バンド内は true、外(列超過/原点より左上)は false", () => {
		expect(isWithinGrid(rect({ x: 0, y: 0 }), spec)).toBe(true); // col0,row0
		expect(isWithinGrid(rect({ x: 300, y: 500 }), spec)).toBe(true); // col3,row5（下は無制限）
		expect(isWithinGrid(rect({ x: 1000, y: 0 }), spec)).toBe(false); // col10 → 列超過
		expect(isWithinGrid(rect({ x: -100, y: 0 }), spec)).toBe(false); // col<0
		expect(isWithinGrid(rect({ x: 0, y: -100 }), spec)).toBe(false); // row<0
		// 左端の手前へ差し込む途中: 左上は原点より左(col-1)でも中心が col0 内なら範囲内
		expect(isWithinGrid(rect({ x: -40, y: 0, width: 100 }), spec)).toBe(true);
	});

	it("dashboardItems は範囲外を除外、allDashboardItems は含める", () => {
		const store = createBoardStore();
		store.addShape(config); // 上の spec と同じ config を board に
		store.addShape(rect({ id: "in", x: 0, y: 0 }));
		store.addShape(rect({ id: "out", x: 1000, y: 0 })); // 列超過 → 範囲外
		expect(
			dashboardItems(store)
				.map((s) => s.id)
				.sort(),
		).toEqual(["in"]);
		expect(
			allDashboardItems(store)
				.map((s) => s.id)
				.sort(),
		).toEqual(["in", "out"]);
	});
});

describe("freeOutOfRange toggle", () => {
	it("OFF なら範囲外も dashboardItems に含める（全部管理）", () => {
		const store = createBoardStore();
		store.addShape(
			makeDashboardConfig({
				columns: 4,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				freeOutOfRange: false,
			}),
		);
		store.addShape(rect({ id: "in", x: 0, y: 0 }));
		store.addShape(rect({ id: "out", x: 1000, y: 0 })); // 列超過だが OFF なので管理
		expect(
			dashboardItems(store)
				.map((s) => s.id)
				.sort(),
		).toEqual(["in", "out"]);
	});
});
