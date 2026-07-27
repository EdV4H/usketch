import { describe, expect, it } from "vitest";
import { ICON_CATEGORIES, ICONS, ICONS_BY_KEY } from "../icons.js";
import { TERRAIN_KEYS, TERRAINS, terrainPatternId } from "../terrain.js";

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
