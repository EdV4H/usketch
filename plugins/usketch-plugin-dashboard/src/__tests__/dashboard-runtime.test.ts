import type { EventBus, PluginContext, ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { makeDashboardConfig } from "../dashboard-config-shape.js";
import { setupDashboard } from "../dashboard-runtime.js";

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

function makeEvents(): EventBus {
	const listeners = new Map<string, Set<(p: unknown) => void>>();
	return {
		on(type: string, fn: (p: unknown) => void) {
			const bucket = listeners.get(type) ?? new Set();
			bucket.add(fn);
			listeners.set(type, bucket);
			return () => bucket.delete(fn);
		},
		emit(type: string, payload: unknown) {
			for (const fn of listeners.get(type) ?? []) fn(payload);
		},
		pause() {},
		resume() {},
		isPaused: () => false,
	} as unknown as EventBus;
}

function harness() {
	const store = createBoardStore();
	const undo: { execute(): void; undo(): void }[] = [];
	const commands = {
		execute(c: { execute(): void; undo(): void }) {
			c.execute();
			undo.push(c);
		},
		undo() {
			undo.pop()?.undo();
		},
		redo() {},
		canUndo: () => undo.length > 0,
		canRedo: () => false,
		getHistorySize: () => undo.length,
		getCursor: () => 0,
	};
	const events = makeEvents();
	const ctx = { store, commands, events } as unknown as PluginContext;
	return { ctx, store, events };
}

const at = (store: ReturnType<typeof createBoardStore>, id: string) => {
	const s = store.getShape(id);
	return s ? { x: s.x, y: s.y } : null;
};

// Simulate the select tool driving a shape drag: the shape is the sole selection
// and its position is written frame-by-frame, then move-end fires on drop.
function drag(
	store: ReturnType<typeof createBoardStore>,
	events: EventBus,
	id: string,
	frames: { x: number; y: number }[],
): void {
	store.setSelection([id]);
	for (const f of frames) store.updateShape(id, f);
	events.emit("shapes:move-end", { shapeIds: [id] });
}

// Faithfully replay the select tool's move drop: live frames (each followed by a
// real timer tick so the reflow rAF fires and shifts siblings), then the pointer-up
// dance — `session.commit()` reverts the dragged shape to its pre-drag position,
// then a microtask replays the move to the drop position and emits move-end.
async function faithfulDrag(
	store: ReturnType<typeof createBoardStore>,
	events: EventBus,
	id: string,
	frames: { x: number; y: number }[],
	original: { x: number; y: number },
): Promise<void> {
	store.setSelection([id]);
	for (const f of frames) {
		store.updateShape(id, f);
		await new Promise((r) => setTimeout(r, 20)); // let the reflow timer fire
	}
	const dropped = frames[frames.length - 1];
	// pointer-up: session.commit() reverts to pre-drag (synchronous, unguarded)
	store.updateShape(id, original);
	// then queueMicrotask { execute(moveCommand) → dropped; emit move-end }
	await Promise.resolve();
	store.updateShape(id, dropped);
	events.emit("shapes:move-end", { shapeIds: [id] });
}

describe("dashboard runtime — faithful select-tool drop", () => {
	it("single row: dragging the last item onto the leftmost makes it first", async () => {
		const { ctx, store, events } = harness();
		store.addShape(
			makeDashboardConfig({
				columns: 3,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				originX: 0,
				originY: 0,
			}),
		);
		store.addShape(rect("a", 0, 0));
		store.addShape(rect("b", 100, 0));
		store.addShape(rect("c", 200, 0));
		const stop = setupDashboard(ctx);
		await Promise.resolve();

		await faithfulDrag(
			store,
			events,
			"c",
			[
				{ x: 140, y: 0 },
				{ x: 40, y: 0 },
				{ x: 10, y: 0 },
			],
			{ x: 200, y: 0 },
		);

		expect(at(store, "c")).toEqual({ x: 0, y: 0 });
		expect(at(store, "a")).toEqual({ x: 100, y: 0 });
		expect(at(store, "b")).toEqual({ x: 200, y: 0 });
		stop();
	});

	it("overshooting LEFT of the origin still inserts first (not freed)", async () => {
		const { ctx, store, events } = harness();
		store.addShape(
			makeDashboardConfig({
				columns: 3,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				originX: 0,
				originY: 0,
			}),
		);
		store.addShape(rect("a", 0, 0));
		store.addShape(rect("b", 100, 0));
		store.addShape(rect("c", 200, 0));
		const stop = setupDashboard(ctx);
		await Promise.resolve();

		// Drop c with its CENTRE left of the origin (top-left -60 → centre -10): the
		// old range check freed it; now it becomes the first item.
		await faithfulDrag(
			store,
			events,
			"c",
			[
				{ x: 120, y: 0 },
				{ x: 0, y: 0 },
				{ x: -60, y: 0 },
			],
			{ x: 200, y: 0 },
		);

		expect(at(store, "c")).toEqual({ x: 0, y: 0 });
		expect(at(store, "a")).toEqual({ x: 100, y: 0 });
		expect(at(store, "b")).toEqual({ x: 200, y: 0 });
		stop();
	});
});

describe("dashboard runtime — overtake right→left", () => {
	function threeInARow() {
		const { ctx, store, events } = harness();
		store.addShape(
			makeDashboardConfig({
				columns: 3,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				originX: 0,
				originY: 0,
			}),
		);
		store.addShape(rect("a", 0, 0));
		store.addShape(rect("b", 100, 0));
		store.addShape(rect("c", 200, 0));
		const stop = setupDashboard(ctx);
		return { ctx, store, events, stop };
	}

	it("隣の1個だけ追い越す: c(col2)→col1 で b と入れ替わる", async () => {
		const { store, events, stop } = threeInARow();
		await Promise.resolve();
		// c の中心を col1 の左半（col0/col1 境界=100 を割り込む位置）へ
		await faithfulDrag(
			store,
			events,
			"c",
			[
				{ x: 120, y: 0 },
				{ x: 90, y: 0 },
			],
			{ x: 200, y: 0 },
		);
		// [a, c, b]
		expect(at(store, "a")).toEqual({ x: 0, y: 0 });
		expect(at(store, "c")).toEqual({ x: 100, y: 0 });
		expect(at(store, "b")).toEqual({ x: 200, y: 0 });
		stop();
	});

	it("ドラッグ中に他アイテムがライブで動く(プレビュー)", async () => {
		const { store, events, stop } = threeInARow();
		await Promise.resolve();
		store.setSelection(["c"]);
		store.updateShape("c", { x: 10, y: 0 }); // c の中心(60)を col0 に入れる
		await new Promise((r) => setTimeout(r, 30)); // reflow フレームを走らせる
		// まだドロップしていないのに a,b が右へ寄る（プレビュー）
		expect(at(store, "a")).toEqual({ x: 100, y: 0 });
		expect(at(store, "b")).toEqual({ x: 200, y: 0 });
		events.emit("shapes:move-end", { shapeIds: ["c"] });
		stop();
	});

	it("隣接2個の入れ替え: b(col1)→col0 で a と入れ替わる", async () => {
		const { store, events, stop } = threeInARow();
		await Promise.resolve();
		await faithfulDrag(
			store,
			events,
			"b",
			[
				{ x: 60, y: 0 },
				{ x: 10, y: 0 },
			],
			{ x: 100, y: 0 },
		);
		// [b, a, c]
		expect(at(store, "b")).toEqual({ x: 0, y: 0 });
		expect(at(store, "a")).toEqual({ x: 100, y: 0 });
		expect(at(store, "c")).toEqual({ x: 200, y: 0 });
		stop();
	});
});

describe("dashboard runtime — absolute avoid-on-drop", () => {
	it("avoid ON: 占有セルにドロップすると相手が最寄りの空きセルへ避ける", async () => {
		const { ctx, store, events } = harness();
		store.addShape(
			makeDashboardConfig({
				columns: 3,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				originX: 0,
				originY: 0,
				mode: "absolute",
				swap: true,
			}),
		);
		store.addShape(rect("a", 0, 0)); // col0
		store.addShape(rect("b", 200, 0)); // col2
		const stop = setupDashboard(ctx);
		await Promise.resolve();

		// b を a の占有セル(col0)へドロップ → a は最寄りの空き(col1)へ避ける
		await faithfulDrag(
			store,
			events,
			"b",
			[
				{ x: 60, y: 0 },
				{ x: 10, y: 0 },
			],
			{ x: 200, y: 0 },
		);
		expect(at(store, "b")).toEqual({ x: 0, y: 0 }); // b → col0
		expect(at(store, "a")).toEqual({ x: 100, y: 0 }); // a → 最寄りの空き col1（元セル col2 ではない）
		stop();
	});

	it("閾値: 一部だけ重なるドロップは閾値次第で避ける", async () => {
		const make = (threshold: number) => {
			const { ctx, store, events } = harness();
			store.addShape(
				makeDashboardConfig({
					columns: 3,
					cellW: 100,
					cellH: 100,
					gap: 0,
					padding: 0,
					originX: 0,
					originY: 0,
					mode: "absolute",
					swap: true,
					swapThreshold: threshold,
				}),
			);
			store.addShape(rect("a", 0, 0));
			store.addShape(rect("b", 200, 0));
			const stop = setupDashboard(ctx);
			return { store, events, stop };
		};
		// b を x=70 にドロップ → a(0..100) と 30% 重なる
		const hi = make(0.5); // 閾値50% → 30%重なりでは避けない
		await Promise.resolve();
		await faithfulDrag(
			hi.store,
			hi.events,
			"b",
			[
				{ x: 120, y: 0 },
				{ x: 70, y: 0 },
			],
			{ x: 200, y: 0 },
		);
		expect(at(hi.store, "a")).toEqual({ x: 0, y: 0 }); // a 不動
		hi.stop();

		const lo = make(0.2); // 閾値20% → 30%重なりで避ける
		await Promise.resolve();
		await faithfulDrag(
			lo.store,
			lo.events,
			"b",
			[
				{ x: 120, y: 0 },
				{ x: 70, y: 0 },
			],
			{ x: 200, y: 0 },
		);
		expect(at(lo.store, "b")).toEqual({ x: 0, y: 0 }); // b → a のセル
		expect(at(lo.store, "a")).toEqual({ x: 100, y: 0 }); // a → 最寄りの空き col1
		lo.stop();
	});

	it("避けはドラッグ中にライブで起き、本体は離すまでスナップされない", async () => {
		const { ctx, store, events } = harness();
		store.addShape(
			makeDashboardConfig({
				columns: 4,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				originX: 0,
				originY: 0,
				mode: "absolute",
				swap: true,
				swapDelay: 0, // このテストは即時ライブ避けを検証
			}),
		);
		store.addShape(rect("a", 100, 0)); // col1（左 col0 は空き）
		store.addShape(rect("b", 300, 0)); // col3
		const stop = setupDashboard(ctx);
		await Promise.resolve();

		store.setSelection(["b"]);
		store.updateShape("b", { x: 110, y: 0 }); // b を掴んで a の上へ
		await new Promise((r) => setTimeout(r, 30)); // reflow フレーム
		expect(at(store, "a")).toEqual({ x: 0, y: 0 }); // a はライブで左へ避ける
		expect(at(store, "b")).toEqual({ x: 110, y: 0 }); // b はスナップされない（ポインタ位置）

		events.emit("shapes:move-end", { shapeIds: ["b"] });
		expect(at(store, "b")).toEqual({ x: 100, y: 0 }); // 離してから col1 へスナップ
		expect(at(store, "a")).toEqual({ x: 0, y: 0 });
		stop();
	});

	it("避けディレイ: ホバー直後は避けず、ディレイ経過後に避ける", async () => {
		const { ctx, store, events } = harness();
		store.addShape(
			makeDashboardConfig({
				columns: 4,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				originX: 0,
				originY: 0,
				mode: "absolute",
				swap: true,
				swapDelay: 150,
			}),
		);
		store.addShape(rect("a", 100, 0)); // col1
		store.addShape(rect("b", 300, 0)); // col3
		const stop = setupDashboard(ctx);
		await Promise.resolve();

		store.setSelection(["b"]);
		store.updateShape("b", { x: 110, y: 0 }); // a の上へホバー
		await new Promise((r) => setTimeout(r, 40));
		expect(at(store, "a")).toEqual({ x: 100, y: 0 }); // ディレイ中はまだ避けない
		await new Promise((r) => setTimeout(r, 220)); // ディレイ経過 → タイマーで反映
		expect(at(store, "a")).toEqual({ x: 0, y: 0 }); // 避けた
		events.emit("shapes:move-end", { shapeIds: ["b"] });
		expect(at(store, "b")).toEqual({ x: 100, y: 0 });
		stop();
	});

	it("中心がセル領域内なら閾値未満の重なりでも避ける(snap非依存)", async () => {
		const { ctx, store, events } = harness();
		store.addShape(
			makeDashboardConfig({
				columns: 3,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				originX: 0,
				originY: 0,
				mode: "absolute",
				swap: true,
				swapThreshold: 0.9, // 高い閾値でも…
			}),
		);
		store.addShape(rect("a", 0, 0));
		store.addShape(rect("b", 200, 0));
		const stop = setupDashboard(ctx);
		await Promise.resolve();
		// b の中心(90)が col0 の領域内 → 重なり60%(<90%)でも中心セル判定で避ける
		await faithfulDrag(
			store,
			events,
			"b",
			[
				{ x: 90, y: 0 },
				{ x: 40, y: 0 },
			],
			{ x: 200, y: 0 },
		);
		expect(at(store, "b")).toEqual({ x: 0, y: 0 }); // b → col0
		expect(at(store, "a")).toEqual({ x: 100, y: 0 }); // a → 最寄りの空き col1
		stop();
	});

	it("左方向ドラッグでは相手を左へ押し出す(左の空きへ避ける)", async () => {
		const { ctx, store, events } = harness();
		store.addShape(
			makeDashboardConfig({
				columns: 4,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				originX: 0,
				originY: 0,
				mode: "absolute",
				swap: true,
			}),
		);
		store.addShape(rect("a", 100, 0)); // col1（左の col0 は空き）
		store.addShape(rect("b", 300, 0)); // col3
		const stop = setupDashboard(ctx);
		await Promise.resolve();
		// b を左へドラッグして a(col1) の上へ → a は左(col0)へ押し出される
		await faithfulDrag(
			store,
			events,
			"b",
			[
				{ x: 200, y: 0 },
				{ x: 110, y: 0 },
			],
			{ x: 300, y: 0 },
		);
		expect(at(store, "b")).toEqual({ x: 100, y: 0 }); // b → col1
		expect(at(store, "a")).toEqual({ x: 0, y: 0 }); // a → 左の col0
		stop();
	});

	it("avoid OFF(既定): 何も避けない(空きセルへ寄る)", async () => {
		const { ctx, store, events } = harness();
		store.addShape(
			makeDashboardConfig({
				columns: 3,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				originX: 0,
				originY: 0,
				mode: "absolute",
			}),
		);
		store.addShape(rect("a", 0, 0));
		store.addShape(rect("b", 200, 0));
		const stop = setupDashboard(ctx);
		await Promise.resolve();
		await faithfulDrag(
			store,
			events,
			"b",
			[
				{ x: 60, y: 0 },
				{ x: 10, y: 0 },
			],
			{ x: 200, y: 0 },
		);
		// a は動かない（占有を維持）
		expect(at(store, "a")).toEqual({ x: 0, y: 0 });
		stop();
	});
});

describe("dashboard runtime — drag to front (swap with leftmost)", () => {
	it("single row: dragging the last item onto the leftmost makes it first", async () => {
		const { ctx, store, events } = harness();
		store.addShape(
			makeDashboardConfig({
				columns: 3,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				originX: 0,
				originY: 0,
			}),
		);
		store.addShape(rect("a", 0, 0));
		store.addShape(rect("b", 100, 0));
		store.addShape(rect("c", 200, 0));
		const stop = setupDashboard(ctx);
		await Promise.resolve(); // flush seedItemIds microtask

		// Drag c leftward onto a's cell (drop centre in col0's left half).
		drag(store, events, "c", [
			{ x: 140, y: 0 },
			{ x: 60, y: 0 },
			{ x: 10, y: 0 },
		]);

		expect(at(store, "c")).toEqual({ x: 0, y: 0 }); // c is now leftmost
		expect(at(store, "a")).toEqual({ x: 100, y: 0 });
		expect(at(store, "b")).toEqual({ x: 200, y: 0 });
		stop();
	});

	it("two rows: dragging the last item onto the very first cell makes it first", async () => {
		const { ctx, store, events } = harness();
		store.addShape(
			makeDashboardConfig({
				columns: 2,
				cellW: 100,
				cellH: 100,
				gap: 0,
				padding: 0,
				originX: 0,
				originY: 0,
			}),
		);
		store.addShape(rect("a", 0, 0)); // r0c0
		store.addShape(rect("b", 100, 0)); // r0c1
		store.addShape(rect("c", 0, 100)); // r1c0
		store.addShape(rect("d", 100, 100)); // r1c1
		const stop = setupDashboard(ctx);
		await Promise.resolve();

		// Drag d (last) up-left onto a's cell (r0c0).
		drag(store, events, "d", [
			{ x: 60, y: 60 },
			{ x: 20, y: 20 },
			{ x: 5, y: 5 },
		]);

		// d should be first: d,a,b,c → r0c0,r0c1,r1c0,r1c1
		expect(at(store, "d")).toEqual({ x: 0, y: 0 });
		expect(at(store, "a")).toEqual({ x: 100, y: 0 });
		expect(at(store, "b")).toEqual({ x: 0, y: 100 });
		expect(at(store, "c")).toEqual({ x: 100, y: 100 });
		stop();
	});
});
