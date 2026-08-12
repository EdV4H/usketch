import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { ICON_CATEGORIES, ICONS, ICONS_BY_KEY } from "../icons.js";
import { TERRAIN_KEYS, TERRAINS, terrainPatternId } from "../terrain.js";
import { lowestTilemap, makeTileMap, seededTilemap } from "../tilemap-shape.js";

describe("terrain definitions", () => {
	it("has 12 terrains with unique keys and non-empty patterns", () => {
		expect(TERRAINS).toHaveLength(12);
		expect(new Set(TERRAIN_KEYS).size).toBe(12);
		for (const t of TERRAINS) {
			expect(t.nodes.length).toBeGreaterThan(0);
			expect(t.patternWidth).toBeGreaterThan(0);
			expect(t.patternHeight).toBeGreaterThan(0);
		}
	});
	it("derives a stable pattern id", () => {
		expect(terrainPatternId("grass")).toBe("uskmap-pat-grass");
	});
});

describe("icon definitions", () => {
	it("has 36 icons, 12 per category, unique keys", () => {
		expect(ICONS).toHaveLength(36);
		expect(new Set(ICONS.map((i) => i.key)).size).toBe(36);
		for (const c of ICON_CATEGORIES) {
			expect(ICONS.filter((i) => i.category === c.id)).toHaveLength(12);
		}
	});
	it("every icon has viewBox + markup and is indexed", () => {
		for (const i of ICONS) {
			expect(i.viewBox).toMatch(/^[\d.\s-]+$/);
			expect(i.nodes.length).toBeGreaterThan(0);
			expect(ICONS_BY_KEY.get(i.key)).toBe(i);
		}
	});
});

describe("seededTilemap", () => {
	const withSeed = (id: string, baseSeed?: number): ShapeData => ({
		...makeTileMap(40),
		id,
		...(baseSeed != null ? { baseSeed } : {}),
	});

	it("returns null when no tilemap carries a seed", () => {
		expect(seededTilemap([withSeed("b"), withSeed("a")])).toBeNull();
		expect(seededTilemap([])).toBeNull();
	});

	it("picks the lowest-id seeded tilemap regardless of iteration order", () => {
		const a = withSeed("aaa", 111);
		const b = withSeed("bbb", 222);
		// Same set, opposite orders → same deterministic winner (lowest id).
		expect(seededTilemap([b, a])?.id).toBe("aaa");
		expect(seededTilemap([a, b])?.id).toBe("aaa");
	});

	it("ignores non-tilemap shapes and unseeded tilemaps", () => {
		const other = { ...makeTileMap(40), id: "zzz", type: "rect" } as unknown as ShapeData;
		const unseeded = withSeed("aaa");
		const seeded = withSeed("mmm", 42);
		expect(seededTilemap([other, unseeded, seeded])?.baseSeed).toBe(42);
	});

	it("rejects non-integer seeds from synced data (NaN/Infinity/fraction)", () => {
		// The lower-id tilemaps carry invalid seeds → skipped; the valid integer wins.
		expect(seededTilemap([withSeed("a", Number.NaN), withSeed("z", 7)])?.id).toBe("z");
		expect(seededTilemap([withSeed("a", Number.POSITIVE_INFINITY), withSeed("z", 7)])?.id).toBe(
			"z",
		);
		expect(seededTilemap([withSeed("a", 1.9), withSeed("z", 7)])?.id).toBe("z");
		// Only invalid seeds present → treated as unseeded.
		expect(seededTilemap([withSeed("a", Number.NaN), withSeed("b", 2.5)])).toBeNull();
	});
});

describe("lowestTilemap", () => {
	const tm = (id: string): ShapeData => ({ ...makeTileMap(40), id });

	it("returns the lowest-id tilemap regardless of order or seed", () => {
		expect(lowestTilemap([tm("bbb"), tm("aaa"), tm("ccc")])?.id).toBe("aaa");
		expect(lowestTilemap([tm("aaa"), tm("bbb")])?.id).toBe("aaa");
	});

	it("ignores non-tilemap shapes and returns null when none exist", () => {
		const other = { ...makeTileMap(40), id: "aaa", type: "rect" } as unknown as ShapeData;
		expect(lowestTilemap([other, tm("zzz")])?.id).toBe("zzz");
		expect(lowestTilemap([other])).toBeNull();
		expect(lowestTilemap([])).toBeNull();
	});
});
