import type { BoardStore, Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import type { BaseInfo } from "../base/base-map-shape.js";
import { baseIdAtWorld, baseRegionAnchors, deleteBase, setBeacon } from "../base/base-ops.js";
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

type Bases = Record<string, { name: string; color: string; radius: number; beaconCell?: string }>;

function harness(bases: Bases) {
	const shapes = new Map<string, ShapeData>();
	shapes.set("bm", {
		id: "bm",
		type: "base-map",
		tile: 40,
		bases,
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
const basesOf = (h: ReturnType<typeof harness>) => (h.shapes.get("bm") as { bases: Bases }).bases;

describe("setBeacon", () => {
	it("sets the base's beacon cell; undo restores", () => {
		const h = harness({ b1: { name: "B1", color: "#f00", radius: 5 } });
		setBeacon({ store: h.store, commands: h.commands, tile: 40 }, "3,2", "b1");
		expect(basesOf(h).b1.beaconCell).toBe("3,2");
		h.getLast()?.undo();
		expect(basesOf(h).b1.beaconCell).toBeUndefined();
	});

	it("enforces 1:1 — moving a cell to another base detaches the first", () => {
		const h = harness({
			b1: { name: "B1", color: "#f00", radius: 5, beaconCell: "3,2" },
			b2: { name: "B2", color: "#00f", radius: 5 },
		});
		setBeacon({ store: h.store, commands: h.commands, tile: 40 }, "3,2", "b2");
		expect(basesOf(h).b2.beaconCell).toBe("3,2");
		expect(basesOf(h).b1.beaconCell).toBeUndefined(); // detached from the same cell
	});

	it("is a no-op when the cell is already this base's beacon", () => {
		const h = harness({ b1: { name: "B1", color: "#f00", radius: 5, beaconCell: "1,1" } });
		setBeacon({ store: h.store, commands: h.commands, tile: 40 }, "1,1", "b1");
		expect(h.getLast()).toBeNull();
	});
});

describe("deleteBase", () => {
	it("removes the base; undo restores", () => {
		const h = harness({
			b1: { name: "B1", color: "#f00", radius: 5, beaconCell: "0,0" },
			b2: { name: "B2", color: "#00f", radius: 5 },
		});
		deleteBase({ store: h.store, commands: h.commands, tile: 40 }, "b1");
		expect(Object.keys(basesOf(h))).toEqual(["b2"]);

		h.getLast()?.undo();
		expect(Object.keys(basesOf(h)).sort()).toEqual(["b1", "b2"]);
	});

	it("is a no-op when the base does not exist", () => {
		const h = harness({
			b1: { name: "B1", color: "#f00", radius: 5 },
			b2: { name: "B2", color: "#00f", radius: 5 },
		});
		deleteBase({ store: h.store, commands: h.commands, tile: 40 }, "ghost");
		expect(h.getLast()).toBeNull();
		expect(Object.keys(basesOf(h)).sort()).toEqual(["b1", "b2"]);
	});
});
