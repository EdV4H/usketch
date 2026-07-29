import type { BoardStore, Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import type { BaseInfo } from "../base/base-map-shape.js";
import { baseIdAtWorld, baseRegionAnchors, deleteBase } from "../base/base-ops.js";
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

describe("deleteBase", () => {
	function harness() {
		const shapes = new Map<string, ShapeData>();
		shapes.set("bm", {
			id: "bm",
			type: "base-map",
			tile: 40,
			bases: {
				b1: { name: "B1", color: "#f00", radius: 5, beaconIconId: "i1" },
				b2: { name: "B2", color: "#00f", radius: 5 },
			},
		} as unknown as ShapeData);
		shapes.set("i1", {
			id: "i1",
			type: "map-icon",
			x: 0,
			y: 0,
			width: 40,
			height: 40,
			meta: { iconKey: "town", category: "landmark", baseId: "b1" },
		} as unknown as ShapeData);
		let last: Command | null = null;
		const store = {
			getShapes: () => shapes,
			getShape: (id: string) => shapes.get(id),
			updateShape: (id: string, patch: Partial<ShapeData>) => {
				const s = shapes.get(id);
				if (s) shapes.set(id, { ...s, ...patch });
			},
		} as unknown as BoardStore;
		const commands = {
			execute: (c: Command) => {
				last = c;
				c.execute();
			},
		} as unknown as CommandRegistry;
		return { shapes, store, commands, getLast: () => last };
	}

	it("removes the base and clears its beacon icon's baseId; undo restores", () => {
		const h = harness();
		deleteBase({ store: h.store, commands: h.commands, tile: 40 }, "b1");
		expect(Object.keys((h.shapes.get("bm") as { bases: object }).bases)).toEqual(["b2"]);
		expect((h.shapes.get("i1") as { meta: { baseId?: string } }).meta.baseId).toBeUndefined();

		h.getLast()?.undo();
		expect(Object.keys((h.shapes.get("bm") as { bases: object }).bases).sort()).toEqual([
			"b1",
			"b2",
		]);
		expect((h.shapes.get("i1") as { meta: { baseId?: string } }).meta.baseId).toBe("b1");
	});

	it("is a no-op when the base does not exist", () => {
		const h = harness();
		deleteBase({ store: h.store, commands: h.commands, tile: 40 }, "ghost");
		expect(h.getLast()).toBeNull();
		expect(Object.keys((h.shapes.get("bm") as { bases: object }).bases).sort()).toEqual([
			"b1",
			"b2",
		]);
	});
});
