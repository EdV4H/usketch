import type { ShapeData } from "@edv4h/usketch-shared";
import { DEFAULT_STYLE } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import {
	AUTO_WIDTH_MIN,
	applyTextBounds,
	computeAutoFitPatch,
	fitTextOnInput,
	fitTextToContent,
	keepTopLeft,
	resizeText,
	SCALE_MIN_FONT_SIZE,
	scaleText,
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

	it("手ぶれ程度（2px 未満）の横ハンドル操作では幅も自動幅も変わらない", () => {
		const narrow = textShape({ autoWidth: true, width: 24 });
		const out = resizeText(narrow, "e", { x: 0.5, y: 0 });
		expect(out.width).toBe(24);
		expect((out as { autoWidth?: boolean }).autoWidth).toBe(true);
		const left = resizeText(narrow, "w", { x: -1, y: 0 });
		expect(left).toMatchObject({ x: 100, width: 24, autoWidth: true });
	});

	it("autoWidth を持たない既存テキストに autoWidth を付け足さない", () => {
		const out = resizeText(textShape(), "e", { x: 30, y: 0 });
		expect("autoWidth" in out).toBe(false);
	});
});

describe("scaleText（角ハンドルで文字ごと拡大縮小）", () => {
	/** 1 文字 = fontSize × 0.5、1 行 = fontSize + padding 8 の計測器 (フォントに比例する)。 */
	const scaledMeasure: TextMeasurer = ({ text, fontSize }) => ({
		width: text.length * fontSize * 0.5 + 8,
		height: fontSize + 8,
	});
	const fontOf = (shape: ShapeData) => (shape as { fontSize?: number }).fontSize;

	it("中身 (padding を除いた枠) を 2 倍に引くと文字も中身も 2 倍になり、反対の角が動かない", () => {
		// 中身は 200 × 32
		const data = textShape({ width: 208, height: 40 });
		const se = scaleText(data, "se", { x: 200, y: 32 }, scaledMeasure);
		expect(se).toMatchObject({ x: 100, y: 50, width: 408, height: 72 });
		expect(fontOf(se)).toBe(32);

		const nw = scaleText(data, "nw", { x: -200, y: -32 }, scaledMeasure);
		// 右下の角 (308, 90) を保つ
		expect(nw).toMatchObject({ x: -100, y: 18, width: 408, height: 72 });
	});

	it("自動幅の文字は自動幅のまま、新しい大きさの中身に合わせる (ポインタに付いてくる)", () => {
		const data = textShape({ autoWidth: true, width: 48, height: 24 });
		const out = scaleText(data, "se", { x: 40, y: 16 }, scaledMeasure);
		expect((out as { autoWidth?: boolean }).autoWidth).toBe(true);
		expect(fontOf(out)).toBe(32);
		// "hello" 5 文字 × 16 + 8、32 + 8 = ドラッグした枠と同じ
		expect(out).toMatchObject({ width: 88, height: 40 });
	});

	it("縮めても枠は最小の高さ、文字は下限を下回らない", () => {
		const data = textShape({ width: 208, height: 40 });
		const out = scaleText(data, "se", { x: -400, y: -80 }, scaledMeasure);
		expect(out.height).toBe(24);
		expect(fontOf(out)).toBe(8);

		const tall = textShape({ width: 208, height: 200 });
		const shrunk = scaleText(tall, "se", { x: -400, y: -400 }, scaledMeasure);
		expect(fontOf(shrunk)).toBe(SCALE_MIN_FONT_SIZE);
	});

	it("下限より小さい文字は、掴んだだけで大きくならない", () => {
		const data = textShape({ width: 208, height: 40, fontSize: 2 });
		const out = scaleText(data, "se", { x: 1, y: 0 }, scaledMeasure);
		expect(fontOf(out)).toBe(2);
		expect(out.width).toBe(208);
	});

	it("動いていなければ何も変えない", () => {
		const data = textShape({ width: 208, height: 40, fontSize: 15.55 });
		expect(scaleText(data, "se", { x: 0, y: 0 }, scaledMeasure)).toEqual(data);
	});

	it("反転して幅 0 になった枠は今までどおり枠だけ変える (潰れない)", () => {
		const data = textShape({ width: 0, height: 40 });
		const out = scaleText(data, "se", { x: 30, y: 10 }, scaledMeasure);
		expect(out).toEqual(resizeText(data, "se", { x: 30, y: 10 }));
		expect(out.width).toBeGreaterThanOrEqual(40);
	});

	it("辺のハンドルは今までどおり枠だけ変える", () => {
		const data = textShape({ autoWidth: true });
		const out = scaleText(data, "e", { x: 30, y: 0 }, scaledMeasure);
		expect(out).toEqual(resizeText(data, "e", { x: 30, y: 0 }));
		expect(fontOf(out)).toBe(16);
	});
});

describe("applyTextBounds（複数選択のリサイズ）", () => {
	it("幅が変われば固定幅に切り替える", () => {
		const patch = applyTextBounds(textShape({ autoWidth: true }), {
			x: 100,
			y: 50,
			width: 120,
			height: 28,
		});
		expect(patch).toEqual({ x: 100, y: 50, width: 120, height: 28, autoWidth: false });
	});

	it("幅が変わらなければ自動幅のまま", () => {
		const patch = applyTextBounds(textShape({ autoWidth: true }), {
			x: 140,
			y: 80,
			width: 200,
			height: 28,
		});
		expect("autoWidth" in patch).toBe(false);
	});
});

describe("keepTopLeft", () => {
	it("回転していなければ null", () => {
		expect(keepTopLeft(textShape(), 300, 28)).toBeNull();
	});

	it("回転したテキストの左上の角を動かさない", () => {
		const shape = textShape({ rotation: 90, x: 0, y: 0, width: 100, height: 20 });
		// 90° 回転: 中心 (50,10)、左上の角はワールドで (60,-40)
		const pos = keepTopLeft(shape, 200, 20) as { x: number; y: number };
		const center = { x: pos.x + 100, y: pos.y + 10 };
		// 新しい左上の角 = 中心 + R(90°)(-100,-10) = 中心 + (10,-100)
		expect(center.x + 10).toBeCloseTo(60);
		expect(center.y - 100).toBeCloseTo(-40);
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

	it("IME 変換中の未確定文字も含めた内容に幅を合わせ、確定で短くなれば縮む", () => {
		const shape = textShape({ autoWidth: true });
		// 「にほんご」と打っている途中（未確定）→ 確定して「日本語」
		expect(fitTextOnInput(shape, "あいうにほんご", measure)).toEqual({ width: 78 });
		expect(fitTextOnInput(shape, "あいう日本語", measure)).toEqual({ width: 68 });
	});

	it("子をレイアウトするコンテナの中では幅を争わずに固定幅へ切り替える", () => {
		expect(
			fitTextOnInput(textShape({ autoWidth: true }), "abcd", measure, { laidOut: true }),
		).toEqual({ autoWidth: false });
	});

	it("回転したテキストは左上の角を保つ位置も返す", () => {
		const shape = textShape({ autoWidth: true, rotation: 90 });
		const patch = fitTextOnInput(shape, "abcd", measure, { height: 28 });
		expect(patch).toMatchObject({ width: 48, ...keepTopLeft(shape, 48, 28) });
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
