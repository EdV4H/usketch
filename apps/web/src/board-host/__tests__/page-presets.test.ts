import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import type { PageMeta } from "@edv4h/usketch-sync";
import { describe, expect, it } from "vitest";
import { PAGE_PRESETS, pagePlugins, pagePreset, seedFromPageId } from "../page-presets.js";
import { PLUGIN_CATALOG } from "../plugin-catalog.js";

const page = (extra: Partial<PageMeta> = {}): PageMeta => ({
	id: "p1",
	name: "A",
	order: "a0",
	createdAt: 0,
	...extra,
});

describe("page presets", () => {
	it("a page uses its plugins, else its preset, else the host's preset", () => {
		expect(pagePlugins(null, "map")).toEqual([...PAGE_PRESETS.map.plugins]);
		expect(pagePlugins(page(), "whiteboard")).toEqual([...PAGE_PRESETS.whiteboard.plugins]);
		expect(pagePlugins(page({ preset: "boardgame" }), "whiteboard")).toEqual([
			...PAGE_PRESETS.boardgame.plugins,
		]);
		expect(pagePlugins(page({ preset: "boardgame", plugins: ["map"] }), "whiteboard")).toEqual([
			"map",
		]);
		expect(pagePreset(page({ preset: "nope" }), "map")).toBe("map");
	});

	it("no preset holds two plugins that cannot be together", () => {
		for (const preset of Object.values(PAGE_PRESETS)) {
			for (const id of preset.plugins) {
				const conflicts = PLUGIN_CATALOG.find((e) => e.id === id)?.conflicts ?? [];
				for (const other of conflicts) {
					expect(preset.plugins.includes(other), `${preset.id}: ${id} × ${other}`).toBe(false);
				}
			}
		}
	});

	it("map-terrain lays the same terrain for the same page, once", () => {
		expect(seedFromPageId("abc")).toBe(seedFromPageId("abc"));
		expect(seedFromPageId("abc")).not.toBe(seedFromPageId("abd"));
		const shapes = new Map<string, ShapeData>();
		const store = {
			getShapes: () => shapes,
			addShape: (shape: ShapeData) => shapes.set(shape.id, shape),
		} as unknown as BoardStore;
		PAGE_PRESETS["map-terrain"].setupEmptyPage?.(store, "abc");
		PAGE_PRESETS["map-terrain"].setupEmptyPage?.(store, "abc");
		expect(shapes.size).toBe(1);
	});
});
