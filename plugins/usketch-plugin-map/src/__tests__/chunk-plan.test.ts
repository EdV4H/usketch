import { describe, expect, it } from "vitest";
import { type ChunkRange, chunkKey, chunkRange, parseChunkKey, planChunks } from "../chunk-plan.js";

const rect = (left: number, top: number, right: number, bottom: number) =>
	({ left, top, right, bottom }) as DOMRectReadOnly;
const range = (cx0: number, cx1: number, cy0: number, cy1: number): ChunkRange => ({
	cx0,
	cx1,
	cy0,
	cy1,
});

describe("chunkRange", () => {
	it("covers the chunks a rect overlaps (exclusive far edges)", () => {
		expect(chunkRange(rect(10, -5, 100, 50), 50)).toEqual(range(0, 1, -1, 0));
		expect(chunkRange(rect(0, 0, 100, 50), 50)).toEqual(range(0, 1, 0, 0));
	});

	it("grows the rect first", () => {
		expect(chunkRange(rect(0, 0, 100, 50), 50, 1)).toEqual(range(-1, 2, -1, 1));
	});

	it("is null for an unknown rect", () => {
		expect(chunkRange(null, 50)).toBeNull();
	});
});

describe("chunk keys", () => {
	it("round-trip, negatives included", () => {
		expect(parseChunkKey(chunkKey(-3, 12))).toEqual([-3, 12]);
	});
});

describe("planChunks", () => {
	const need = range(0, 1, 0, 0);
	const soon = range(0, 2, 0, 0);
	const keep = range(-1, 3, -1, 1);

	it("draws every needed chunk at once, and the coming ones within the budget", () => {
		const plan = planChunks([], need, range(0, 3, 0, 0), keep, 1);
		expect(plan.chunks).toEqual(["0,0", "1,0", "2,0"]);
		expect(plan.pending).toBe(true);
		const next = planChunks(plan.chunks, need, range(0, 3, 0, 0), keep, 1);
		expect(next.chunks).toEqual(["0,0", "1,0", "2,0", "3,0"]);
		expect(next.pending).toBe(false);
	});

	it("returns the same list when nothing changes", () => {
		const prev = ["0,0", "1,0", "2,0"];
		const plan = planChunks(prev, need, soon, keep, 1);
		expect(plan.chunks).toBe(prev);
		expect(plan.pending).toBe(false);
	});

	it("keeps drawn chunks in order, appends new ones and drops far ones", () => {
		// Moved one chunk right: 0,0 is still within `keep`, 5,0 is not.
		const plan = planChunks(["5,0", "1,0", "0,0"], range(1, 2, 0, 0), range(1, 2, 0, 0), keep, 0);
		expect(plan.chunks).toEqual(["1,0", "0,0", "2,0"]);
	});
});
