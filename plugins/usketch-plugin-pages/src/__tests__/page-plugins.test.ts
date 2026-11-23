import { describe, expect, it } from "vitest";
import { conflictingPlugins, type PagePluginChoice, togglePlugin } from "../page-plugins.js";

const choices: PagePluginChoice[] = [
	{ id: "map", label: "マップ" },
	{ id: "elevation", label: "標高", conflicts: ["map"] },
	{ id: "character", label: "キャラ" },
];

describe("page plugins", () => {
	it("adds in catalog order and removes", () => {
		expect(togglePlugin(["character"], "map", true, choices)).toEqual(["map", "character"]);
		expect(togglePlugin(["map", "character"], "map", false, choices)).toEqual(["character"]);
	});

	it("turning one on turns off what it conflicts with, either way round", () => {
		expect(togglePlugin(["map", "character"], "elevation", true, choices)).toEqual([
			"elevation",
			"character",
		]);
		expect(togglePlugin(["elevation", "character"], "map", true, choices)).toEqual([
			"map",
			"character",
		]);
	});

	it("tells which plugins a choice would replace", () => {
		expect(conflictingPlugins(["map", "character"], "elevation", choices)).toEqual(["map"]);
		expect(conflictingPlugins(["elevation"], "map", choices)).toEqual(["elevation"]);
		expect(conflictingPlugins(["character"], "map", choices)).toEqual([]);
	});
});
