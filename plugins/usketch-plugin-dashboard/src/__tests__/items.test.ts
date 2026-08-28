import type { ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { makeDashboardConfig } from "../dashboard-config-shape.js";
import { dashboardItems, isDashboardItem } from "../items.js";

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
