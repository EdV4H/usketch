import type { ShapeData } from "@edv4h/usketch-shared";
import { DEFAULT_STYLE } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import {
	AUTO_WIDTH_MIN,
	computeAutoFitPatch,
	fitTextOnInput,
	fitTextToContent,
	resizeText,
	type TextMeasurer,
} from "./text-sizing.js";

/** 1 文字 = 10px、1 行 = 20px + 上下 padding 8 の決定的な計測器。 */
const measure: TextMeasurer = ({ text }) => {
	const lines = text.split("\n");
	const longest = Math.max(...lines.map((l) => l.length));
	return { width: longest * 10 + 8, height: lines.length * 20 + 8 };
};

function textShape(overrides: Record<string, unknown> = {}): ShapeData {
	return {
		id: "t1",
		type: "text",
		x: 100,
		y: 50,
		width: 200,
		height: 28,
		style: { ...DEFAULT_STYLE, fill: "transparent", strokeWidth: 0 },
		text: "hello",
		fontSize: 16,
		fontFamily: "system-ui, sans-serif",
		isEditing: false,
		...overrides,
	} as ShapeData;
}

describe("resizeText", () => {
	it.each(["e", "w", "ne", "nw", "se", "sw"] as const)(
		"自動幅のテキストを %s ハンドルで動かすと固定幅に切り替わる",
		(handle) => {
			const out = resizeText(textShape({ autoWidth: true }), handle, { x: 30, y: 0 });
			expect((out as { autoWidth?: boolean }).autoWidth).toBe(false);
		},
	);

	it.each(["n", "s"] as const)("%s ハンドルは高さだけ変えて自動幅のまま", (handle) => {
		const out = resizeText(textShape({ autoWidth: true }), handle, { x: 0, y: 40 });
		expect((out as { autoWidth?: boolean }).autoWidth).toBe(true);
		expect(out.width).toBe(200);
	});

	it("最小幅より狭い自動幅テキストでも n/s ハンドルでは幅が広がらない", () => {
		const out = resizeText(textShape({ autoWidth: true, width: AUTO_WIDTH_MIN }), "s", {
			x: 0,
			y: 40,
		});
		expect(out.width).toBe(AUTO_WIDTH_MIN);
		expect((out as { autoWidth?: boolean }).autoWidth).toBe(true);
	});

	it("ハンドルを掴んだだけで幅が変わらなければ自動幅のまま", () => {
		const out = resizeText(textShape({ autoWidth: true }), "e", { x: 0, y: 0 });
		expect((out as { autoWidth?: boolean }).autoWidth).toBe(true);
	});

	it("固定幅のテキストは e ハンドルで幅だけ変わる", () => {
		const out = resizeText(textShape({ autoWidth: false }), "e", { x: 30, y: 0 });
		expect(out.width).toBe(230);
		expect((out as { autoWidth?: boolean }).autoWidth).toBe(false);
	});

	it("autoWidth を持たない既存テキストに autoWidth を付け足さない", () => {
		const out = resizeText(textShape(), "e", { x: 30, y: 0 });
		expect("autoWidth" in out).toBe(false);
	});
});

describe("computeAutoFitPatch", () => {
	it("いちばん長い行の幅と行数ぶんの高さにフィットし、自動幅に戻す", () => {
		const patch = computeAutoFitPatch(textShape({ text: "abc\nabcdef" }), measure);
		expect(patch).toEqual({ autoWidth: true, width: 68, height: 48 });
	});

	it("空のテキストは最小幅を下回らない", () => {
		const patch = computeAutoFitPatch(textShape({ text: "" }), measure);
		expect(patch.width).toBe(AUTO_WIDTH_MIN);
	});
});

describe("fitTextOnInput", () => {
	it("自動幅なら入力中のテキストに幅を合わせる", () => {
		expect(fitTextOnInput(textShape({ autoWidth: true }), "abcd", measure)).toEqual({
			width: 48,
		});
	});

	it("固定幅（autoWidth 無し含む）は幅を変えない", () => {
		expect(fitTextOnInput(textShape({ autoWidth: false }), "abcd", measure)).toBeNull();
		expect(fitTextOnInput(textShape(), "abcd", measure)).toBeNull();
	});
});

describe("fitTextToContent", () => {
	it("固定幅テキストを自動幅に戻してフィットし、Undo 1 回で元に戻る", () => {
		const store = createBoardStore();
		store.addShape(textShape({ autoWidth: false, width: 300, height: 100, text: "abc" }));

		const command = fitTextToContent(store, "t1", measure);
		expect(command).not.toBeNull();
		command?.execute();
		const fitted = store.getShape("t1") as ShapeData & { autoWidth?: boolean };
		expect(fitted.autoWidth).toBe(true);
		expect(fitted.width).toBe(38);
		expect(fitted.height).toBe(28);
		expect(fitted.x).toBe(100);

		command?.undo();
		const restored = store.getShape("t1") as ShapeData & { autoWidth?: boolean };
		expect(restored.autoWidth).toBe(false);
		expect(restored.width).toBe(300);
		expect(restored.height).toBe(100);
	});

	it("既にフィットしているなら何もしない", () => {
		const store = createBoardStore();
		store.addShape(textShape({ autoWidth: true, width: 38, height: 28, text: "abc" }));
		expect(fitTextToContent(store, "t1", measure)).toBeNull();
	});

	it("text 以外や存在しない図形には何もしない", () => {
		const store = createBoardStore();
		store.addShape(textShape({ id: "r1", type: "rectangle" }));
		expect(fitTextToContent(store, "r1", measure)).toBeNull();
		expect(fitTextToContent(store, "missing", measure)).toBeNull();
	});
});
