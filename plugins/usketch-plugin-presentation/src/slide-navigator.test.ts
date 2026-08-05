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
