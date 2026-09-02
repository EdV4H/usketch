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

describe("DashboardApi mode", () => {
	it("既定は flow、setMode で absolute に切り替わる（getMode に反映）", () => {
		const { ctx, store } = makeCtx();
		store.addShape(rect("a", 0, 0));
		const api = createDashboardApi(ctx);
		api.enable();
		expect(api.getMode()).toBe("flow");
		api.setMode("absolute");
		expect(api.getMode()).toBe("absolute");
	});

	it("absolute では離れたセルに置いても手前へ詰めない（隙間を保持）", () => {
		const { ctx, store } = makeCtx();
		store.addShape(rect("a", 0, 0, 100, 100));
		store.addShape(rect("b", 0, 0, 100, 100));
		const api = createDashboardApi(ctx, { columns: 4, cellW: 100, cellH: 100, gap: 0, padding: 0 });
		api.enable();
		api.setMode("absolute");
		// b を cell(3,0) 相当へ移動してから repack → 詰めずにそのセルに留まる
		store.updateShape("b", { x: 300, y: 0 });
		api.repack();
		expect(pos(store, "a")).toEqual({ x: 0, y: 0 }); // cell0
		expect(pos(store, "b")).toEqual({ x: 300, y: 0 }); // cell3（col1,2 は空き）
	});
});

describe("DashboardApi fitToGrid", () => {
	it("setFitToGrid(true) で各アイテムのサイズを最も近いセルにスナップする", () => {
		const { ctx, store } = makeCtx();
		store.addShape(rect("a", 0, 0, 100, 100));
		store.addShape(rect("b", 300, 0, 150, 150)); // 半端サイズ
		const api = createDashboardApi(ctx, { columns: 4, gap: 0, padding: 0 });
		api.enable(); // セルは最小(100)にシード
		expect(api.getGridSpec()?.cellW).toBe(100);
		expect(api.getFitToGrid()).toBe(false);

		api.setFitToGrid(true);
		expect(api.getFitToGrid()).toBe(true);
		// a=100x100 は 1x1 のまま。b=150x150 は 2x2(=200x200) にスナップ
		expect(store.getShape("a")).toMatchObject({ width: 100, height: 100 });
		expect(store.getShape("b")).toMatchObject({ width: 200, height: 200 });
	});

	it("fitToGrid ON でセルサイズを変えるとアイテムも即リサイズされる", () => {
		const { ctx, store } = makeCtx();
		store.addShape(rect("a", 0, 0, 100, 100));
		const api = createDashboardApi(ctx, { columns: 4, gap: 0, padding: 0 });
		api.enable(); // セル=最小(100)
		api.setFitToGrid(true);
		expect(store.getShape("a")).toMatchObject({ width: 100, height: 100 });
		// セルを 200 に → a は最寄りセル(1 セル=200)へ即リサイズ
		api.setCellSize(200, 200);
		expect(store.getShape("a")).toMatchObject({ width: 200, height: 200 });
	});

	it("setFitToGrid(false) はサイズを変えない", () => {
		const { ctx, store } = makeCtx();
		store.addShape(rect("a", 0, 0, 150, 150));
		const api = createDashboardApi(ctx, { columns: 4, gap: 0, padding: 0 });
		api.enable();
		api.setFitToGrid(false);
		expect(api.getFitToGrid()).toBe(false);
		expect(store.getShape("a")).toMatchObject({ width: 150, height: 150 });
	});
});

describe("DashboardApi freeOutOfRange", () => {
	it("既定は true、setFreeOutOfRange(false) で切り替わる", () => {
		const { ctx, store } = makeCtx();
		store.addShape(rect("a", 0, 0));
		const api = createDashboardApi(ctx);
		api.enable();
		expect(api.getFreeOutOfRange()).toBe(true);
		api.setFreeOutOfRange(false);
		expect(api.getFreeOutOfRange()).toBe(false);
		api.setFreeOutOfRange(true);
		expect(api.getFreeOutOfRange()).toBe(true);
	});
});

describe("DashboardApi viewportLock", () => {
	it("既定は off(false)、setViewportLock で ON/OFF が切り替わる", () => {
		const { ctx, store } = makeCtx();
		store.addShape(rect("a", 0, 0));
		const api = createDashboardApi(ctx);
		api.enable();
		expect(api.getViewportLock()).toBe(false);
		api.setViewportLock(true);
		expect(api.getViewportLock()).toBe(true);
		api.setViewportLock(false);
		expect(api.getViewportLock()).toBe(false);
	});

	it("セル幅auto は既定 false、setCellWidthAuto で切替。setCellSize は数値幅を保持", () => {
		const { ctx, store } = makeCtx();
		store.addShape(rect("a", 0, 0));
		const api = createDashboardApi(ctx, { columns: 4, cellW: 200, gap: 0, padding: 0 });
		api.enable();
		expect(api.getCellWidthAuto()).toBe(false);
		api.setCellWidthAuto(true);
		expect(api.getCellWidthAuto()).toBe(true);
		// 数値幅に戻す（=auto解除）。制限中でも幅は保持される。
		api.setCellWidthAuto(false);
		api.setCellSize(240, 140);
		expect(api.getCellWidthAuto()).toBe(false);
		expect(api.getGridSpec()?.cellW).toBe(240);
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
