import type { ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it, vi } from "vitest";
import {
	canStepPresentation,
	carryPresentStart,
	type PresentationPagesOptions,
	stepPresentation,
	takePresentStart,
} from "./page-step.js";
import { SlideNavigator } from "./slide-navigator.js";

function frame(id: string, x: number): ShapeData {
	return {
		id,
		type: "frame",
		x,
		y: 0,
		width: 100,
		height: 100,
		style: { fill: "#fff", stroke: "#000", strokeWidth: 1, opacity: 1 },
	} as ShapeData;
}

function setup() {
	const store = createBoardStore();
	store.addShape(frame("f1", 0));
	store.addShape(frame("f2", 200));
	const nav = new SlideNavigator(store, () => ({ width: 800, height: 600 }));
	return nav;
}

function pages(
	next: boolean,
	prev: boolean,
): PresentationPagesOptions & {
	goToPage: ReturnType<typeof vi.fn>;
} {
	return { hasPage: (step) => (step === 1 ? next : prev), goToPage: vi.fn() };
}

describe("stepPresentation", () => {
	it("ページの中に進める先があればスライドを送る", () => {
		const nav = setup();
		nav.first();
		const p = pages(true, true);
		expect(stepPresentation(nav, 1, p)).toBe("slide");
		expect(nav.getCurrentIndex()).toBe(1);
		expect(p.goToPage).not.toHaveBeenCalled();
		nav.destroy();
	});

	it("最後のスライドの次は次のページの先頭へ、最初の前は前のページの最後へ", () => {
		const nav = setup();
		nav.last();
		const p = pages(true, true);
		expect(stepPresentation(nav, 1, p)).toBe("page");
		expect(p.goToPage).toHaveBeenLastCalledWith(1);
		expect(takePresentStart()).toBe("first");

		nav.first();
		expect(stepPresentation(nav, -1, p)).toBe("page");
		expect(p.goToPage).toHaveBeenLastCalledWith(-1);
		expect(takePresentStart()).toBe("last");
		// 受け取ると消える
		expect(takePresentStart()).toBe("first");
		nav.destroy();
	});

	it("隣のページも無ければ今のスライドのまま", () => {
		const nav = setup();
		nav.last();
		const p = pages(false, false);
		expect(stepPresentation(nav, 1, p)).toBe("none");
		expect(stepPresentation(nav, 1)).toBe("none");
		expect(nav.getCurrentIndex()).toBe(1);
		expect(p.goToPage).not.toHaveBeenCalled();
		expect(canStepPresentation(nav, 1, p)).toBe(false);
		expect(canStepPresentation(nav, 1, pages(true, false))).toBe(true);
		expect(canStepPresentation(nav, -1, p)).toBe(true);
		nav.destroy();
	});
});

describe("takePresentStart", () => {
	it("預けてから時間が経つと先頭から始める", () => {
		carryPresentStart("last", 1000);
		expect(takePresentStart(1000 + 60_000)).toBe("first");
		carryPresentStart("last", 1000);
		expect(takePresentStart(2000)).toBe("last");
	});
});
