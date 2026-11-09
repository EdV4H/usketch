import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { encodeChunk } from "../elevation-codec.js";
import {
	DEFAULT_GEN,
	MAX_HEIGHT,
	makeChunkShape,
	makeFieldShape,
	normalizeField,
	normalizeGen,
} from "../elevation-field.js";
import {
	baseCacheSize,
	boardElevation,
	elevationHeightAt,
	elevationSampler,
	setBaseCacheLimit,
} from "../elevation-model.js";
import { baseHeight } from "../elevation-noise.js";
import { fakeStore } from "./helpers.js";

/** Deltas (world units) for a 32×32 chunk from a function of the local sample. */
function deltas(f: (li: number, lj: number) => number): string {
	const v = new Int16Array(32 * 32);
	for (let lj = 0; lj < 32; lj++) for (let li = 0; li < 32; li++) v[lj * 32 + li] = f(li, lj) * 4;
	return encodeChunk(v);
}

describe("normalizeField / normalizeGen", () => {
	it("replaces junk with the defaults and keeps values in range", () => {
		const f = normalizeField({
			...makeFieldShape("f"),
			spacing: -3,
			chunk: 7.5,
			seed: 1.5,
			waterLevel: Number.NaN,
		} as never);
		expect(f).toMatchObject({ spacing: 16, chunk: 32, seed: null, waterLevel: null });
		expect(normalizeGen({ relief: 1e9, octaves: 99, roughness: -1, scale: "x" })).toEqual({
			...DEFAULT_GEN,
			relief: MAX_HEIGHT,
			octaves: 8,
			roughness: 0,
		});
	});
});

describe("boardElevation", () => {
	it("is null without a field, and picks the lowest-id field", () => {
		expect(boardElevation(fakeStore())).toBeNull();
		const store = fakeStore([makeFieldShape("b", { seed: 2 }), makeFieldShape("a", { seed: 1 })]);
		expect(boardElevation(store)?.field.id).toBe("a");
	});

	it("keeps the same model while only other shapes change", () => {
		const field = makeFieldShape("f");
		const store = fakeStore([field]);
		const first = boardElevation(store);
		store.addShape({ id: "sticky", type: "sticky" } as ShapeData);
		expect(boardElevation(store)).toBe(first);
		const chunk = makeChunkShape(
			normalizeField(field),
			0,
			0,
			deltas(() => 1),
		);
		store.addShape(chunk);
		const second = boardElevation(store);
		expect(second).not.toBe(first);
		expect(second?.chunks.size).toBe(1);
	});

	it("skips chunks of other fields and undecodable ones", () => {
		const field = makeFieldShape("f");
		const cfg = normalizeField(field);
		const other = {
			...makeChunkShape(
				cfg,
				1,
				0,
				deltas(() => 1),
			),
			field: "g",
			id: "x",
		};
		const bad = { ...makeChunkShape(cfg, 2, 0, "nope"), id: "y" };
		const store = fakeStore([
			field,
			other,
			bad,
			makeChunkShape(
				cfg,
				0,
				0,
				deltas(() => 1),
			),
		]);
		expect([...(boardElevation(store)?.chunks.keys() ?? [])]).toEqual(["0,0"]);
	});
});

describe("elevationSampler", () => {
	it("adds the deltas to a flat board and interpolates between samples", () => {
		const field = makeFieldShape("f");
		const cfg = normalizeField(field);
		const store = fakeStore([
			field,
			makeChunkShape(
				cfg,
				0,
				0,
				deltas((li) => li * 2),
			),
		]);
		const s = elevationSampler(boardElevation(store) as never);
		expect(s.sample(3, 5)).toBe(6);
		expect(s.heightAt(3 * 16, 0)).toBe(6);
		expect(s.heightAt(3.5 * 16, 0)).toBe(7);
		expect(elevationHeightAt(store, 8, 8)).toBe(1);
		// Outside the chunk: flat, never below 0.
		expect(s.sample(-1, 0)).toBe(0);
		expect(s.sample(40, 40)).toBe(0);
	});

	it("never goes below 0 or above the maximum", () => {
		const field = makeFieldShape("f", { seed: 3, gen: DEFAULT_GEN });
		const cfg = normalizeField(field);
		const store = fakeStore([
			field,
			makeChunkShape(
				cfg,
				0,
				0,
				deltas((li) => (li < 16 ? -8000 : 8000)),
			),
		]);
		const s = elevationSampler(boardElevation(store) as never);
		expect(s.sample(0, 0)).toBe(0);
		expect(s.sample(20, 0)).toBe(MAX_HEIGHT);
	});

	it("reads the generated terrain at sample points, the same at every level", () => {
		const field = makeFieldShape("f", { seed: 9, gen: DEFAULT_GEN });
		const store = fakeStore([field]);
		const s = elevationSampler(boardElevation(store) as never);
		expect(s.sample(5, -7)).toBe(Math.fround(baseHeight(9, DEFAULT_GEN, 5 * 16, -7 * 16)));
		for (const [i, j] of [
			[0, 0],
			[64, -128],
			[-256, 512],
		]) {
			expect(s.sample(i, j, 2)).toBe(s.sample(i, j));
			expect(s.sample(i, j, 6)).toBe(s.sample(i, j));
		}
	});

	it("keeps at most the cache limit of generated chunks", () => {
		setBaseCacheLimit(4);
		const field = makeFieldShape("f", { seed: 11, gen: DEFAULT_GEN });
		const s = elevationSampler(boardElevation(fakeStore([field])) as never);
		for (let k = 0; k < 10; k++) s.sample(k * 32, 0);
		expect(baseCacheSize()).toBeLessThanOrEqual(4);
		setBaseCacheLimit(512);
	});
});
