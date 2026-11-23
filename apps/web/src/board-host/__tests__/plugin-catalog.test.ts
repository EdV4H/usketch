import { describe, expect, it } from "vitest";
import { PAGE_PRESETS } from "../page-presets.js";
import {
	CATALOG_IDS,
	type CatalogEntry,
	PLUGIN_CATALOG,
	selectCatalogEntries,
} from "../plugin-catalog.js";

const entry = (id: string, extra: Partial<CatalogEntry> = {}): CatalogEntry => ({
	id,
	label: id,
	create: () => null,
	...extra,
});

describe("plugin catalog", () => {
	it("has one entry per id", () => {
		expect(CATALOG_IDS.size).toBe(PLUGIN_CATALOG.length);
	});

	it("every preset names catalog entries that are not base", () => {
		for (const preset of Object.values(PAGE_PRESETS)) {
			for (const id of preset.plugins) {
				expect(CATALOG_IDS.has(id), `${preset.id}: ${id}`).toBe(true);
				expect(PLUGIN_CATALOG.find((e) => e.id === id)?.base, `${preset.id}: ${id}`).not.toBe(true);
			}
		}
	});

	it("selects in catalog order, always keeps base, and drops server-only entries offline", () => {
		const catalog = [
			entry("base-a", { base: true }),
			entry("x"),
			entry("server", { needsServer: true }),
			entry("y"),
		];
		const selected = new Set(["y", "server", "x"]);
		expect(selectCatalogEntries(selected, { connected: true }, catalog).map((e) => e.id)).toEqual([
			"base-a",
			"x",
			"server",
			"y",
		]);
		expect(selectCatalogEntries(selected, { connected: false }, catalog).map((e) => e.id)).toEqual([
			"base-a",
			"x",
			"y",
		]);
		expect(selectCatalogEntries(new Set(), { connected: false }, catalog).map((e) => e.id)).toEqual(
			["base-a"],
		);
	});

	it("keeps the registration rules in the catalog order", () => {
		const index = (id: string) => PLUGIN_CATALOG.findIndex((e) => e.id === id);
		// 置き場とダッシュボードは入れ物の後
		expect(index("container")).toBeLessThan(index("tabletop"));
		expect(index("container")).toBeLessThan(index("dashboard"));
		// タブを足す側より前にサイドパネル
		expect(index("side-panel")).toBeLessThan(index("comments"));
		expect(index("side-panel")).toBeLessThan(index("activity-feed"));
		expect(index("side-panel")).toBeLessThan(index("board-info-panel"));
		// 標高はマップの後、スタート位置は deep-link の前、HUD は最後
		expect(index("map")).toBeLessThan(index("elevation"));
		expect(index("start-position")).toBeLessThan(index("deep-link"));
		expect(index("debug-hud")).toBe(PLUGIN_CATALOG.length - 1);
	});
});
