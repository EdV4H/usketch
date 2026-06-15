import { describe, expect, it } from "vitest";
import { drawTop, shuffle } from "../deck.js";

describe("drawTop", () => {
	it("returns the top card (index 0) and the rest", () => {
		const { card, rest } = drawTop(["a", "b", "c"]);
		expect(card).toBe("a");
		expect(rest).toEqual(["b", "c"]);
	});

	it("returns null card for an empty deck", () => {
		const { card, rest } = drawTop<string>([]);
		expect(card).toBeNull();
		expect(rest).toEqual([]);
	});

	it("does not mutate the input", () => {
		const input = ["a", "b"];
		drawTop(input);
		expect(input).toEqual(["a", "b"]);
	});
});

describe("shuffle", () => {
	it("keeps the same multiset of cards", () => {
		const input = Array.from({ length: 52 }, (_, i) => i);
		const out = shuffle(input);
		expect(out).toHaveLength(52);
		expect([...out].sort((a, b) => a - b)).toEqual(input);
	});

	it("does not mutate the input", () => {
		const input = [1, 2, 3, 4, 5];
		const copy = [...input];
		shuffle(input);
		expect(input).toEqual(copy);
	});
});
