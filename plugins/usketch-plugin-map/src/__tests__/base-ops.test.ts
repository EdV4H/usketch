import { describe, expect, it } from "vitest";
import type { BaseInfo } from "../base/base-map-shape.js";
import { baseIdAtWorld, baseRegionAnchors } from "../base/base-ops.js";
import type { Territory } from "../base/territory.js";

describe("baseIdAtWorld", () => {
	const territory: Territory = { "0,0": "red", "1,0": "blue" };
	it("maps a world point to the owning base", () => {
		expect(baseIdAtWorld(territory, 10, 10, 40)).toBe("red"); // cell 0,0
		expect(baseIdAtWorld(territory, 50, 10, 40)).toBe("blue"); // cell 1,0
	});
	it("returns null for unowned cells", () => {
		expect(baseIdAtWorld(territory, 200, 200, 40)).toBeNull();
	});
});

describe("baseRegionAnchors", () => {
	const bases: Record<string, BaseInfo> = {
		red: { name: "Red", color: "#EF5350", radius: 5 },
		blue: { name: "Blue", color: "#4A7FB8", radius: 5 },
	};
	it("gives one centred anchor per base that owns cells", () => {
		const territory: Territory = { "0,0": "red", "2,0": "red", "10,10": "blue" };
		const anchors = baseRegionAnchors(territory, bases, 40);
		const red = anchors.find((a) => a.baseId === "red");
		expect(red?.count).toBe(2);
		// bbox cols 0..2 → centre = (0+2+1)/2 * 40 = 60
		expect(red?.x).toBe(60);
		expect(red?.name).toBe("Red");
		expect(anchors.find((a) => a.baseId === "blue")?.count).toBe(1);
	});
	it("skips bases with no owned cells and unknown base ids", () => {
		const territory: Territory = { "0,0": "ghost" }; // base not in registry
		expect(baseRegionAnchors(territory, bases, 40)).toEqual([]);
	});
});
