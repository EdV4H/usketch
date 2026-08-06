import { describe, expect, it } from "vitest";
import { drawN, drawTop, shuffle } from "../deck.js";

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

describe("drawN", () => {
	it("draws the top n cards and returns the rest", () => {
		const { drawn, rest } = drawN(["a", "b", "c", "d", "e"], 3);
		expect(drawn).toEqual(["a", "b", "c"]);
		expect(rest).toEqual(["d", "e"]);
	});

	it("draws all when n equals the length", () => {
		const { drawn, rest } = drawN(["a", "b"], 2);
		expect(drawn).toEqual(["a", "b"]);
		expect(rest).toEqual([]);
	});

	it("clamps n to the available count (does not overdraw)", () => {
		const { drawn, rest } = drawN(["a", "b"], 5);
		expect(drawn).toEqual(["a", "b"]);
		expect(rest).toEqual([]);
	});

	it("draws nothing for n <= 0 or an empty deck", () => {
		expect(drawN(["a", "b"], 0)).toEqual({ drawn: [], rest: ["a", "b"] });
		expect(drawN(["a", "b"], -3)).toEqual({ drawn: [], rest: ["a", "b"] });
		expect(drawN<string>([], 3)).toEqual({ drawn: [], rest: [] });
	});

	it("does not mutate the input", () => {
		const input = ["a", "b", "c"];
		drawN(input, 2);
		expect(input).toEqual(["a", "b", "c"]);
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
