import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import {
	ensureDashboardConfig,
	getDashboardConfig,
	gridSpecFromConfig,
	setConfig,
} from "../config-ops.js";
import { DASHBOARD_DEFAULTS, makeDashboardConfig } from "../dashboard-config-shape.js";

describe("gridSpecFromConfig", () => {
	it("config の設定と origin を GridSpec に射影する", () => {
		const config = makeDashboardConfig({ columns: 5, cellW: 120, originX: 300, originY: 40 });
		expect(gridSpecFromConfig(config)).toEqual({
			columns: 5,
			cellW: 120,
			cellH: DASHBOARD_DEFAULTS.cellH,
			gap: DASHBOARD_DEFAULTS.gap,
			padding: DASHBOARD_DEFAULTS.padding,
			originX: 300,
			originY: 40,
		});
	});
});

describe("ensureDashboardConfig", () => {
	it("最初の呼び出しで config を生成し、以降は同じものを返す（シングルトン）", () => {
		const store = createBoardStore();
		expect(getDashboardConfig(store)).toBeUndefined();

		const first = ensureDashboardConfig(store);
		expect(getDashboardConfig(store)?.id).toBe(first.id);

		const second = ensureDashboardConfig(store);
		expect(second.id).toBe(first.id);
		// 二重生成していないこと
		const configs = [...store.getShapes().values()].filter((s) => s.type === "dashboard-config");
		expect(configs).toHaveLength(1);
	});

	it("defaults を反映する", () => {
		const store = createBoardStore();
		const config = ensureDashboardConfig(store, { columns: 6, gap: 4 });
		expect(config.columns).toBe(6);
		expect(config.gap).toBe(4);
		expect(config.locked).toBe(true);
	});
});

describe("setConfig", () => {
	it("既存 config を部分更新する", () => {
		const store = createBoardStore();
		ensureDashboardConfig(store);
		setConfig(store, { columns: 8, padding: 40 });
		const config = getDashboardConfig(store);
		expect(config?.columns).toBe(8);
		expect(config?.padding).toBe(40);
		// 触っていないフィールドは既定のまま
		expect(config?.cellW).toBe(DASHBOARD_DEFAULTS.cellW);
	});

	it("config が無いボードでは no-op", () => {
		const store = createBoardStore();
		expect(() => setConfig(store, { columns: 3 })).not.toThrow();
		expect(getDashboardConfig(store)).toBeUndefined();
	});
});
