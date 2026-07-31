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
		expect(fit).toHaveBeenCalledWith(
			{ x: 500, y: 300, width: 200, height: 150 },
			{ width: 800, height: 600 },
		);
		nav.destroy();
	});
});
