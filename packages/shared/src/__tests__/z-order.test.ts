import { describe, expect, it } from "vitest";
import { compareZIndex, zIndexAfterAll, zIndexBeforeAll, zIndexBetween } from "../utils/z-order.js";

describe("compareZIndex", () => {
	it("同値で 0", () => {
		expect(compareZIndex("a0", "a0")).toBe(0);
	});
	it("undefined は最小扱い", () => {
		expect(compareZIndex(undefined, "a0")).toBeLessThan(0);
		expect(compareZIndex("a0", undefined)).toBeGreaterThan(0);
		expect(compareZIndex(undefined, undefined)).toBe(0);
	});
	it("辞書順比較", () => {
		expect(compareZIndex("a0", "a1")).toBeLessThan(0);
		expect(compareZIndex("b", "a")).toBeGreaterThan(0);
	});
});

describe("zIndexBetween", () => {
	it("lower < result < upper を満たす", () => {
		const key = zIndexBetween("a0", "a2");
		expect(key > "a0").toBe(true);
		expect(key < "a2").toBe(true);
	});

	it("null 境界でも有効なキーを返す", () => {
		const k1 = zIndexBetween(null, null);
		expect(k1.length).toBeGreaterThan(0);
		const k2 = zIndexBetween(null, "a0");
		expect(k2 < "a0").toBe(true);
		const k3 = zIndexBetween("a0", null);
		expect(k3 > "a0").toBe(true);
	});

	it("jitter: 同一 (lower, upper) で異なるキーを返す", () => {
		const keys = new Set<string>();
		for (let i = 0; i < 20; i++) {
			keys.add(zIndexBetween("a0", "a2"));
		}
		expect(keys.size).toBeGreaterThan(1);
		for (const k of keys) {
			expect(k > "a0").toBe(true);
			expect(k < "a2").toBe(true);
		}
	});
});

describe("zIndexAfterAll", () => {
	it("空配列で有効なキーを返す", () => {
		const key = zIndexAfterAll([]);
		expect(key.length).toBeGreaterThan(0);
	});

	it("全てのキーより後にソートされる", () => {
		const existing = ["a0", "a1", "a2"];
		const key = zIndexAfterAll(existing);
		for (const k of existing) expect(key > k).toBe(true);
	});

	it("undefined を無視する", () => {
		const key = zIndexAfterAll([undefined, "a0", undefined]);
		expect(key > "a0").toBe(true);
	});
});

describe("zIndexBeforeAll", () => {
	it("空配列で有効なキーを返す", () => {
		const key = zIndexBeforeAll([]);
		expect(key.length).toBeGreaterThan(0);
	});

	it("全てのキーより前にソートされる", () => {
		const existing = ["a1", "a2", "a3"];
		const key = zIndexBeforeAll(existing);
		for (const k of existing) expect(key < k).toBe(true);
	});
});

describe("insert-between stress", () => {
	it("1000 回連続 insert-between で文字列長が暴走しない", () => {
		let lower = zIndexBetween(null, null);
		let upper = zIndexBetween(lower, null);
		for (let i = 0; i < 1000; i++) {
			const mid = zIndexBetween(lower, upper);
			expect(mid > lower).toBe(true);
			expect(mid < upper).toBe(true);
			// Alternate which side we split to keep growth bounded-ish
			if (i % 2 === 0) upper = mid;
			else lower = mid;
		}
		// sanity: length should stay under ~1000 chars (jitter adds 6 per call
		// but we only keep one endpoint, so growth is bounded by alternation)
		expect(lower.length).toBeLessThan(2000);
		expect(upper.length).toBeLessThan(2000);
	});
});
