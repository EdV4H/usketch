import { describe, expect, it } from "vitest";
import { generateHopLabels } from "../hop.js";

describe("generateHopLabels", () => {
	it("件数がアルファベット以内なら1文字", () => {
		expect(generateHopLabels(3, "abcde")).toEqual(["a", "b", "c"]);
	});

	it("アルファベット^2 を超えても固定長で count 件返す（undefined にならない）", () => {
		// 17 文字 → 17^2=289 < 300 なので 3 文字ラベルになる
		const labels = generateHopLabels(300, "abcdefghijklmnopq");
		expect(labels.length).toBe(300);
		expect(labels.every((l) => typeof l === "string" && l.length === 3)).toBe(true);
		expect(new Set(labels).size).toBe(300); // 全てユニーク
	});

	it("超過ちょうどの境界（289 → 2文字, 290 → 3文字）", () => {
		expect(generateHopLabels(289, "abcdefghijklmnopq").every((l) => l.length === 2)).toBe(true);
		expect(generateHopLabels(290, "abcdefghijklmnopq").every((l) => l.length === 3)).toBe(true);
	});

	it("count<=0 は空配列", () => {
		expect(generateHopLabels(0, "abc")).toEqual([]);
	});

	it("アルファベットが1文字以下なら best-effort（無限ループしない）", () => {
		expect(generateHopLabels(5, "a")).toEqual(["a"]);
	});
});
