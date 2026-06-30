import { describe, expect, it } from "vitest";
import { brushOutlineD, smoothPressure, speedPressure } from "../geometry/brush-outline.js";
import { simplifyPoints } from "../geometry/simplify.js";
import { smoothPathD } from "../geometry/smooth-path.js";

describe("smoothPathD", () => {
	it("2点未満は空", () => {
		expect(smoothPathD([])).toBe("");
		expect(smoothPathD([{ x: 1, y: 2 }])).toBe("");
	});
	it("中点二次ベジェ（M…Q…L）を生成", () => {
		const d = smoothPathD([
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 20, y: 0 },
		]);
		expect(d.startsWith("M 0 0")).toBe(true);
		expect(d).toContain("Q");
		expect(d.trimEnd().endsWith("L 20 0")).toBe(true);
	});
});

describe("speedPressure", () => {
	it("ゆっくり=太い(p→1)、速い=細い(p→0)", () => {
		const slow = speedPressure(0.2, 16, 60); // ほぼ静止
		const fast = speedPressure(50, 1, 60); // 高速
		expect(slow).toBeGreaterThan(0.9);
		expect(fast).toBe(0);
	});
	it("0..1 にクランプ", () => {
		const p = speedPressure(1000, 1, 60);
		expect(p).toBeGreaterThanOrEqual(0);
		expect(p).toBeLessThanOrEqual(1);
	});
});

describe("smoothPressure", () => {
	it("前値へ向けて係数分だけ寄せる", () => {
		expect(smoothPressure(0, 1, 0.4)).toBeCloseTo(0.4);
		expect(smoothPressure(1, 0, 0.4)).toBeCloseTo(0.6);
	});
});

describe("simplifyPoints", () => {
	it("直線上の中間点を間引き、端点を保持", () => {
		const pts = [
			{ x: 0, y: 0 },
			{ x: 5, y: 0 },
			{ x: 10, y: 0 },
			{ x: 15, y: 0 },
			{ x: 20, y: 0 },
		];
		const out = simplifyPoints(pts, 0.6);
		expect(out.length).toBe(2);
		expect(out[0]).toEqual({ x: 0, y: 0 });
		expect(out[out.length - 1]).toEqual({ x: 20, y: 0 });
	});
	it("曲がりがある点は残す & p を保持", () => {
		const pts = [
			{ x: 0, y: 0, p: 0.5 },
			{ x: 5, y: 10, p: 0.7 },
			{ x: 10, y: 0, p: 0.3 },
		];
		const out = simplifyPoints(pts, 0.6);
		expect(out.length).toBe(3);
		expect(out[1].p).toBe(0.7);
	});
	it("tolerance<=0 は原本", () => {
		const pts = [
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
			{ x: 2, y: 0 },
		];
		expect(simplifyPoints(pts, 0)).toBe(pts);
	});
});

describe("brushOutlineD", () => {
	it("筆ペンの塗りアウトライン d を生成（M で始まり Z で閉じる）", () => {
		const d = brushOutlineD(
			[
				{ x: 0, y: 0, p: 0.4 },
				{ x: 10, y: 5, p: 0.8 },
				{ x: 20, y: 0, p: 0.3 },
			],
			11,
		);
		expect(d.startsWith("M")).toBe(true);
		expect(d.trimEnd().endsWith("Z")).toBe(true);
	});
	it("空点列は空文字", () => {
		expect(brushOutlineD([], 11)).toBe("");
	});
});
