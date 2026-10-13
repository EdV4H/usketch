import type { ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it, vi } from "vitest";
import { SlideNavigator } from "./slide-navigator.js";

function shape(overrides: Partial<ShapeData> = {}): ShapeData {
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

const viewport = () => ({ width: 800, height: 600 });

describe("SlideNavigator isSlide predicate", () => {
	it("既定では Frame シェイプだけをスライドにする", () => {
		const store = createBoardStore();
		store.addShape(shape({ id: "f1", type: "frame" }));
		store.addShape(shape({ id: "r1", type: "rectangle" }));
		store.addShape(shape({ id: "f2", type: "frame" }));

		const nav = new SlideNavigator(store, viewport);
		expect(nav.getSlides().map((s) => s.id)).toEqual(["f1", "f2"]);
		nav.destroy();
	});

	it("isSlide を渡すと Frame 以外や条件付き Frame をスライドにできる", () => {
		const store = createBoardStore();
		store.addShape(shape({ id: "f1", type: "frame", meta: { isSlide: true } }));
		store.addShape(shape({ id: "f2", type: "frame" })); // フラグ無し → 除外
		store.addShape(shape({ id: "f3", type: "frame", meta: { isSlide: true } }));

		const nav = new SlideNavigator(store, viewport, {
			isSlide: (s) => s.type === "frame" && s.meta?.isSlide === true,
		});
		expect(nav.getSlides().map((s) => s.id)).toEqual(["f1", "f3"]);
		nav.destroy();
	});

	it("スライド化フラグの付け外しで一覧と onChange が更新される", () => {
		const store = createBoardStore();
		store.addShape(shape({ id: "f1", type: "frame", meta: { isSlide: true } }));

		const nav = new SlideNavigator(store, viewport, {
			isSlide: (s) => s.type === "frame" && s.meta?.isSlide === true,
		});
		const onChange = vi.fn();
		nav.onChange(onChange);
		expect(nav.getSlides()).toHaveLength(1);

		// フラグを外す → スライドから外れ、一覧が空になり通知される
		store.updateShape("f1", { meta: { isSlide: false } });
		expect(nav.getSlides()).toHaveLength(0);
		expect(onChange).toHaveBeenCalled();

		// もう一度立てる → 復帰
		store.updateShape("f1", { meta: { isSlide: true } });
		expect(nav.getSlides().map((s) => s.id)).toEqual(["f1"]);
		nav.destroy();
	});

	it("gotoIndex で対象スライドの矩形に fitToBounds する", () => {
		const store = createBoardStore();
		store.addShape(shape({ id: "f1", type: "frame", x: 0, y: 0, width: 100, height: 100 }));
		store.addShape(shape({ id: "f2", type: "frame", x: 500, y: 300, width: 200, height: 150 }));
		const fit = vi.spyOn(store, "fitToBounds");

		const nav = new SlideNavigator(store, viewport);
		nav.gotoIndex(1);

		expect(nav.getCurrentIndex()).toBe(1);
		// 既定の余白 40 で fitToBounds に渡す。
		expect(fit).toHaveBeenCalledWith(
			{ x: 500, y: 300, width: 200, height: 150 },
			{ width: 800, height: 600 },
			40,
		);
		nav.destroy();
	});

	it("fitPadding を渡すと fitToBounds の余白として使う (発表の画角いっぱい=0)", () => {
		const store = createBoardStore();
		store.addShape(shape({ id: "f1", type: "frame", x: 0, y: 0, width: 100, height: 100 }));
		store.addShape(shape({ id: "f2", type: "frame", x: 500, y: 300, width: 200, height: 150 }));
		const fit = vi.spyOn(store, "fitToBounds");

		const nav = new SlideNavigator(store, viewport, { fitPadding: 0 });
		nav.gotoIndex(1);

		expect(fit).toHaveBeenCalledWith(
			{ x: 500, y: 300, width: 200, height: 150 },
			{ width: 800, height: 600 },
			0,
		);
		nav.destroy();
	});

	it("getCurrentBounds は現在スライドの矩形を返す (無ければ null)", () => {
		const store = createBoardStore();
		const nav0 = new SlideNavigator(store, viewport);
		expect(nav0.getCurrentBounds()).toBeNull();
		nav0.destroy();

		store.addShape(shape({ id: "f1", type: "frame", x: 0, y: 0, width: 100, height: 100 }));
		store.addShape(shape({ id: "f2", type: "frame", x: 500, y: 300, width: 200, height: 150 }));
		const nav = new SlideNavigator(store, viewport);
		expect(nav.getCurrentBounds()).toEqual({ x: 0, y: 0, width: 100, height: 100 });
		nav.gotoIndex(1);
		expect(nav.getCurrentBounds()).toEqual({
			x: 500,
			y: 300,
			width: 200,
			height: 150,
		});
		nav.destroy();
	});

	it("getStore は内部 store を返す", () => {
		const store = createBoardStore();
		const nav = new SlideNavigator(store, viewport);
		expect(nav.getStore()).toBe(store);
		nav.destroy();
	});
});

describe("SlideNavigator スライド内ステップ", () => {
	// f1 (1 ステップ) → d1 (3 ステップ) → f2 (1 ステップ)
	function setup() {
		const store = createBoardStore();
		store.addShape(shape({ id: "f1", type: "frame", x: 0 }));
		store.addShape(shape({ id: "d1", type: "deck", x: 200, meta: { steps: 3 } }));
		store.addShape(shape({ id: "f2", type: "frame", x: 400 }));
		const nav = new SlideNavigator(store, viewport, {
			isSlide: (s) => s.type === "frame" || s.type === "deck",
			getStepCount: (s) => (typeof s.meta?.steps === "number" ? s.meta.steps : 1),
		});
		return { store, nav };
	}

	const pos = (nav: SlideNavigator) => [nav.getCurrentIndex(), nav.getCurrentStep()];

	it("next はスライド内のステップを使い切ってから次のスライドへ進む", () => {
		const { store, nav } = setup();
		const fit = vi.spyOn(store, "fitToBounds");
		const visited: number[][] = [pos(nav)];
		for (let i = 0; i < 4; i++) {
			nav.next();
			visited.push(pos(nav));
		}
		expect(visited).toEqual([
			[0, 0],
			[1, 0],
			[1, 1],
			[1, 2],
			[2, 0],
		]);
		// 画角を動かすのはスライドが変わったときだけ (f1→d1, d1→f2)
		expect(fit).toHaveBeenCalledTimes(2);
		nav.destroy();
	});

	it("prev は前のスライドの最終ステップへ戻る", () => {
		const { nav } = setup();
		nav.gotoIndex(2);
		nav.prev();
		expect(pos(nav)).toEqual([1, 2]);
		nav.prev();
		nav.prev();
		expect(pos(nav)).toEqual([1, 0]);
		nav.prev();
		expect(pos(nav)).toEqual([0, 0]);
		nav.destroy();
	});

	it("hasNext / hasPrev は両端で false になる", () => {
		const { nav } = setup();
		expect(nav.hasPrev()).toBe(false);
		expect(nav.hasNext()).toBe(true);
		nav.last();
		expect(pos(nav)).toEqual([2, 0]);
		expect(nav.hasNext()).toBe(false);
		nav.gotoIndex(1, 2);
		expect(nav.hasNext()).toBe(true);
		expect(nav.hasPrev()).toBe(true);
		nav.destroy();
	});

	it("末尾で next しても位置は変わらない", () => {
		const { nav } = setup();
		nav.gotoIndex(1, 2);
		nav.last();
		nav.next();
		expect(pos(nav)).toEqual([2, 0]);
		nav.destroy();
	});

	it("onChange にステップ位置も渡す", () => {
		const { nav } = setup();
		const onChange = vi.fn();
		nav.onChange(onChange);
		nav.gotoIndex(1);
		nav.next();
		expect(onChange).toHaveBeenLastCalledWith(1, 1);
		nav.destroy();
	});

	it("ステップ数が減ると現在のステップを範囲内に戻す", () => {
		const { store, nav } = setup();
		nav.gotoIndex(1, 2);
		store.updateShape("d1", { meta: { steps: 2 } });
		expect(pos(nav)).toEqual([1, 1]);
		nav.destroy();
	});

	it("gotoIndex の step はステップ数に clamp する", () => {
		const { nav } = setup();
		nav.gotoIndex(1, 99);
		expect(pos(nav)).toEqual([1, 2]);
		nav.gotoIndex(0, 5);
		expect(pos(nav)).toEqual([0, 0]);
		nav.destroy();
	});
});
