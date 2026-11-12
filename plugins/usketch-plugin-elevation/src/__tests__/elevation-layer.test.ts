import { describe, expect, it } from "vitest";
import { makeFieldShape, normalizeField } from "../elevation-field.js";
import { tileRevision } from "../elevation-layer.js";
import type { ElevationModel } from "../elevation-model.js";

const field = normalizeField(makeFieldShape("f"));
const n = field.chunk;
const model = (chunks: [string, Int16Array][]): ElevationModel => ({
	field,
	chunks: new Map(chunks),
});
const at = (i: number, j: number, v = 8) => {
	const a = new Int16Array(n * n);
	a[j * n + i] = v;
	return a;
};

describe("tileRevision", () => {
	it("at level 0, a neighbour counts only by the strip the tile reads", () => {
		const empty = tileRevision(model([]), 0, 0, 0);
		expect(empty).toBe("");
		// Right neighbour (1,0): columns 0…2 are read, column 10 is not.
		expect(tileRevision(model([["1,0", at(10, 5)]]), 0, 0, 0)).toBe(empty);
		expect(tileRevision(model([["1,0", at(2, 5)]]), 0, 0, 0)).not.toBe(empty);
		// Left neighbour (-1,0): the last two columns.
		expect(tileRevision(model([["-1,0", at(n - 3, 5)]]), 0, 0, 0)).toBe(empty);
		expect(tileRevision(model([["-1,0", at(n - 2, 5)]]), 0, 0, 0)).not.toBe(empty);
		// Corner (1,1): only its top-left 3 × 3.
		expect(tileRevision(model([["1,1", at(3, 0)]]), 0, 0, 0)).toBe(empty);
		expect(tileRevision(model([["1,1", at(2, 2)]]), 0, 0, 0)).not.toBe(empty);
	});

	it("the tile's own chunk counts by its array, and the same values give the same strip key", () => {
		const a = at(10, 10);
		expect(tileRevision(model([["0,0", a]]), 0, 0, 0)).toBe(
			tileRevision(model([["0,0", a]]), 0, 0, 0),
		);
		expect(tileRevision(model([["0,0", a]]), 0, 0, 0)).not.toBe(
			tileRevision(model([["0,0", at(10, 10)]]), 0, 0, 0),
		);
		expect(tileRevision(model([["1,0", at(1, 1)]]), 0, 0, 0)).toBe(
			tileRevision(model([["1,0", at(1, 1)]]), 0, 0, 0),
		);
	});

	it("is remembered per model, and a model with new deltas is worked out again", () => {
		const m = model([["0,0", at(10, 10)]]);
		const first = tileRevision(m, 0, 0, 0);
		expect(tileRevision(m, 0, 0, 0)).toBe(first);
		// Brushing gives a new model (new chunk arrays): its revision differs.
		const brushed = model([...m.chunks, ["1,0", at(1, 1)]]);
		expect(tileRevision(brushed, 0, 0, 0)).not.toBe(first);
		// Another tile of the same model is its own entry.
		expect(tileRevision(m, 0, 5, 5)).toBe("");
	});
});
