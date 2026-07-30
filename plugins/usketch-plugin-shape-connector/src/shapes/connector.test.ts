import { describe, expect, it } from "vitest";
import { arrowSizeFor } from "./connector.js";

describe("arrowSizeFor", () => {
	it("既定の線幅(2)では従来サイズ(10)を維持する", () => {
		expect(arrowSizeFor(2)).toBe(10);
	});

	it("細い線でも下限 10 を下回らない", () => {
		expect(arrowSizeFor(1)).toBe(10);
		expect(arrowSizeFor(0.5)).toBe(10);
	});

	it("太い線では頭が線幅に比例して大きくなる", () => {
		expect(arrowSizeFor(4)).toBe(20);
		expect(arrowSizeFor(6)).toBe(30);
	});

	it("不正値(0/NaN/負)は既定幅(2)扱いで 10 にフォールバックする", () => {
		expect(arrowSizeFor(0)).toBe(10);
		expect(arrowSizeFor(Number.NaN)).toBe(10);
		expect(arrowSizeFor(-4)).toBe(10);
	});
});
