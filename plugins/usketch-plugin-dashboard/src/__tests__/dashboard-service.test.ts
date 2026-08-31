import type { Command, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { getDashboardConfig } from "../config-ops.js";
import { makeDashboardConfig } from "../dashboard-config-shape.js";
import { createDashboardApi } from "../dashboard-service.js";

// Minimal command registry with a real undo stack — createDashboardApi only
// touches ctx.store and ctx.commands, so we can cast a partial context.
function makeCtx() {
	const store = createBoardStore();
	const undoStack: Command[] = [];
	const commands = {
		execute(cmd: Command) {
			cmd.execute();
			undoStack.push(cmd);
		},
		undo() {
			const cmd = undoStack.pop();
			cmd?.undo();
		},
	};
	const ctx = { store, commands } as unknown as PluginContext;
	return { ctx, store, commands };
}

function rect(id: string, x: number, y: number, width = 100, height = 100): ShapeData {
	return {
		id,
		type: "rectangle",
		x,
		y,
		width,
		height,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	};
}

const pos = (store: ReturnType<typeof createBoardStore>, id: string) => {
	const s = store.getShape(id);
	return s ? { x: s.x, y: s.y } : null;
};

describe("DashboardApi enable/repack", () => {
	it("enable でボードをダッシュボード化し、既存トップレベル Shape をグリッド整列する", () => {
		const { ctx, store } = makeCtx();
		store.addShape(rect("a", 500, 500));
		store.addShape(rect("b", 20, 20));
		store.addShape(rect("c", 900, 30));

		const api = createDashboardApi(ctx, { columns: 2, cellW: 100, cellH: 100, gap: 0, padding: 0 });
		expect(api.isDashboardBoard()).toBe(false);

		api.enable();
		expect(api.isDashboardBoard()).toBe(true);

		// 初回 enable は原点をアイテム左上（min x/y − padding）へシードする。
		// padding0・min=(20,20) → origin(20,20)。reading order は幾何ベースで
		// b(20,20)→row0col0, c(900,30)→row0col1, a(500,500)→row1col0。
		// 2 列・cell100・gap0 → (20,20)/(120,20)/(20,120)
		expect(pos(store, "b")).toEqual({ x: 20, y: 20 });
		expect(pos(store, "c")).toEqual({ x: 120, y: 20 });
		expect(pos(store, "a")).toEqual({ x: 20, y: 120 });
	});

	it("config シングルトンはアイテムに数えない", () => {
		const { ctx, store } = makeCtx();
		store.addShape(rect("a", 0, 0));
		const api = createDashboardApi(ctx, { columns: 3, cellW: 100, cellH: 100, gap: 0, padding: 0 });
		api.enable();
		const config = getDashboardConfig(store);
		expect(config).toBeDefined();
		// config は locked・面積0 なので packSpans 対象外（a だけが動く対象）
		expect(pos(store, "a")).toEqual({ x: 0, y: 0 });
	});
});

describe("DashboardApi setColumns undo", () => {
	it("列数変更で再レイアウトし、undo で config と位置がまとめて戻る", () => {
		const { ctx, store, commands } = makeCtx();
		store.addShape(rect("a", 0, 0));
		store.addShape(rect("b", 0, 0));
		store.addShape(rect("c", 0, 0));
		const api = createDashboardApi(ctx, { columns: 3, cellW: 100, cellH: 100, gap: 0, padding: 0 });
		api.enable(); // a,b,c → (0,0),(100,0),(200,0)
		expect(pos(store, "c")).toEqual({ x: 200, y: 0 });

		api.setColumns(1); // 1 列 → 縦積み: a(0,0), b(0,100), c(0,200)
		expect(api.getGridSpec()?.columns).toBe(1);
		expect(pos(store, "b")).toEqual({ x: 0, y: 100 });
		expect(pos(store, "c")).toEqual({ x: 0, y: 200 });

		commands.undo(); // 列数変更を取り消し → 3 列レイアウトに戻る
		expect(api.getGridSpec()?.columns).toBe(3);
		expect(pos(store, "b")).toEqual({ x: 100, y: 0 });
		expect(pos(store, "c")).toEqual({ x: 200, y: 0 });
	});
});

describe("DashboardApi enable cell seeding (span)", () => {
	it("セルを最小アイテムにシードし、大きいアイテムが複数セルをまたぐ", () => {
		const { ctx, store } = makeCtx();
		store.addShape(rect("small", 0, 0, 100, 100));
		store.addShape(rect("big", 300, 0, 200, 100)); // 幅 2 セル分
		const api = createDashboardApi(ctx, { columns: 3, gap: 0, padding: 0 });
		api.enable();

		// セルは最小アイテム（100×100）にシードされる
		expect(api.getGridSpec()).toMatchObject({ cellW: 100, cellH: 100, originX: 0, originY: 0 });
		// reading order [small, big]。small=1x1@col0、big=2col@col1-2
		expect(pos(store, "small")).toEqual({ x: 0, y: 0 });
		expect(pos(store, "big")).toEqual({ x: 100, y: 0 });
	});
});

describe("DashboardApi enable contract", () => {
	it("すでに dashboard でも enable は再パックする（no-op ではない）", () => {
		const { ctx, store } = makeCtx();
		store.addShape(rect("a", 0, 0));
		const api = createDashboardApi(ctx, { columns: 2, cellW: 100, cellH: 100, gap: 0, padding: 0 });
		api.enable();
		expect(pos(store, "a")).toEqual({ x: 0, y: 0 });

		// グリッドから手で外す → 再度 enable すると詰め直される
		store.updateShape("a", { x: 999, y: 999 });
		api.enable();
		expect(pos(store, "a")).toEqual({ x: 0, y: 0 });
	});
});

describe("DashboardApi input hardening", () => {
	it("非有限値（NaN/Infinity）は無視して config を壊さない", () => {
		const { ctx } = makeCtx();
		const api = createDashboardApi(ctx, {
			columns: 3,
			cellW: 100,
			cellH: 100,
			gap: 8,
			padding: 10,
		});
		api.enable();
		api.setColumns(Number.NaN);
		api.setCellSize(Number.NaN, 100);
		api.setGap(Number.POSITIVE_INFINITY);
		api.setPadding(Number.NaN);
		expect(api.getGridSpec()).toEqual({
			columns: 3,
			cellW: 100,
			cellH: 100,
			gap: 8,
			padding: 10,
			originX: 0,
			originY: 0,
		});
	});
});

describe("DashboardApi disable", () => {
	it("disable で config を除去し、ボードは非ダッシュボードに戻る", () => {
		const { ctx, store } = makeCtx();
		store.addShape(rect("a", 0, 0));
		const api = createDashboardApi(ctx);
		api.enable();
		expect(api.isDashboardBoard()).toBe(true);
		api.disable();
		expect(api.isDashboardBoard()).toBe(false);
		expect(getDashboardConfig(store)).toBeUndefined();
	});

	it("config が複数あっても disable で全て除去し非ダッシュボードに戻る", () => {
		const { ctx, store } = makeCtx();
		// 同時 enable で config が 2 つ残った状況を再現
		store.addShape({ ...makeDashboardConfig(), id: "cfg-a" });
		store.addShape({ ...makeDashboardConfig(), id: "cfg-b" });
		const api = createDashboardApi(ctx);
		expect(api.isDashboardBoard()).toBe(true);
		api.disable();
		expect(api.isDashboardBoard()).toBe(false);
		expect([...store.getShapes().values()].some((s) => s.type === "dashboard-config")).toBe(false);
	});
});
