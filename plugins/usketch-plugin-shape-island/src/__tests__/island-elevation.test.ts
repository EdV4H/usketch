import type { Command, ShapeData } from "@edv4h/usketch-shared";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import {
	clampElevation,
	getIslandElevation,
	islandElevationAt,
	liftedShapeElevations,
	MAX_ISLAND_ELEVATION,
	setIslandElevation,
} from "../island-elevation.js";
import { clusterBlobs, sliceDepths } from "../island-metaball-layer.js";
import { createDefaultIsland } from "../island-render.js";

function setup() {
	const store = createBoardStore();
	const stack: Command[] = [];
	const commands = {
		execute(cmd: Command) {
			cmd.execute();
			stack.push(cmd);
		},
		undo() {
			stack.pop()?.undo();
		},
	};
	return { store, commands, stack };
}

function island(id: string, x: number, y: number, elevation?: number): ShapeData {
	return {
		...createDefaultIsland({ id, x, y }),
		width: 100,
		height: 100,
		islandElevation: elevation,
	};
}

function sticky(id: string, x: number, y: number, parentId?: string): ShapeData {
	return {
		id,
		type: "sticky",
		x,
		y,
		width: 20,
		height: 20,
		style: { fill: "#ff0", stroke: "#000", strokeWidth: 1, opacity: 1 },
		parentId,
	};
}

describe("clampElevation", () => {
	it("rounds into [0, MAX]", () => {
		expect(clampElevation(-5)).toBe(0);
		expect(clampElevation(Number.NaN)).toBe(0);
		expect(clampElevation(12.4)).toBe(12);
		expect(clampElevation(10_000)).toBe(MAX_ISLAND_ELEVATION);
	});
});

describe("setIslandElevation", () => {
	it("sets islands only, as one undoable command", () => {
		const { store, commands, stack } = setup();
		store.addShape(island("a", 0, 0));
		store.addShape(island("b", 200, 0));
		store.addShape(sticky("s", 10, 10));

		const changed = setIslandElevation(store, commands, ["a", "b", "s"], 80);
		expect(changed).toEqual(["a", "b"]);
		expect(stack).toHaveLength(1);
		expect(getIslandElevation(store.getShape("a"))).toBe(80);
		expect(getIslandElevation(store.getShape("b"))).toBe(80);
		expect("islandElevation" in (store.getShape("s") ?? {})).toBe(false);

		commands.undo();
		expect(getIslandElevation(store.getShape("a"))).toBe(0);
		expect(getIslandElevation(store.getShape("b"))).toBe(0);
	});

	it("skips unchanged islands and clears the field at 0", () => {
		const { store, commands, stack } = setup();
		store.addShape(island("a", 0, 0, 40));
		expect(setIslandElevation(store, commands, ["a"], 40)).toEqual([]);
		expect(stack).toHaveLength(0);
		setIslandElevation(store, commands, ["a"], 0);
		expect((store.getShape("a") as { islandElevation?: number }).islandElevation).toBeUndefined();
	});
});

describe("islandElevationAt", () => {
	it("returns the highest island under the point, 0 elsewhere", () => {
		const { store } = setup();
		store.addShape(island("low", 0, 0, 20));
		store.addShape(island("high", 50, 50, 60));
		expect(islandElevationAt(store, 10, 10)).toBe(20);
		expect(islandElevationAt(store, 75, 75)).toBe(60);
		expect(islandElevationAt(store, 500, 500)).toBe(0);
	});
});

describe("liftedShapeElevations", () => {
	it("lifts members of raised islands (through nested containers)", () => {
		const { store } = setup();
		store.addShape(island("a", 0, 0, 50));
		store.addShape(island("flat", 300, 0));
		store.addShape({ ...sticky("frame", 10, 10, "a"), type: "frame" });
		store.addShape(sticky("onA", 20, 20, "a"));
		store.addShape(sticky("inFrame", 30, 30, "frame"));
		store.addShape(sticky("onFlat", 310, 10, "flat"));
		store.addShape(sticky("loose", 600, 600));

		const lifts = liftedShapeElevations(store);
		expect(Object.fromEntries(lifts)).toEqual({ frame: 50, onA: 50, inFrame: 50 });
	});
});

describe("clusterBlobs", () => {
	const blob = (id: string, elevation: number, groupId?: string) => ({
		id,
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		color: "#a8d5ba",
		elevation,
		groupId,
	});

	it("fuses group members of the same height only, low to high", () => {
		const clusters = clusterBlobs([
			blob("a", 40, "g"),
			blob("b", 0, "g"),
			blob("c", 40, "g"),
			blob("d", 10),
		]);
		expect(clusters.map((c) => [c.elevation, c.blobs.map((b) => b.id)])).toEqual([
			[0, ["b"]],
			[10, ["d"]],
			[40, ["a", "c"]],
		]);
	});
});

describe("sliceDepths", () => {
	it("stacks slices from the ground up to (not including) the top", () => {
		expect(sliceDepths(0)).toEqual([]);
		expect(sliceDepths(8)).toEqual([0, 4]);
		const tall = sliceDepths(1000);
		expect(tall.length).toBe(24);
		expect(tall[0]).toBe(0);
		expect(Math.max(...tall)).toBeLessThan(1000);
	});
});
