import type { BoardStore, Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { eraseRangeBox } from "../range-erase.js";

// Minimal in-memory store + command capture (eraseRangeBox only uses getShapes /
// updateShape / commands.execute). Range-erase clears terrain only — base
// territory is derived, not stored.
function makeHarness(initial: ShapeData[]) {
	const shapes = new Map<string, ShapeData>(initial.map((s) => [s.id, s]));
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

const tilemap = {
	id: "tm",
	type: "tilemap",
	tile: 40,
	cells: { "0,0": "grass", "5,5": "grass" },
} as unknown as ShapeData;

describe("eraseRangeBox", () => {
	it("clears terrain inside the box, and undo restores it", () => {
		const h = makeHarness([structuredClone(tilemap)]);
		eraseRangeBox(
			{ store: h.store, commands: h.commands, tile: 40 },
			{ minC: 0, minR: 0, maxC: 2, maxR: 2 }, // covers cell 0,0 but not 5,5
			{ terrain: true },
		);
		expect((h.shapes.get("tm") as { cells: Record<string, string> }).cells).toEqual({
			"5,5": "grass",
		});

		h.getLast()?.undo();
		expect((h.shapes.get("tm") as { cells: Record<string, string> }).cells).toEqual({
			"0,0": "grass",
			"5,5": "grass",
		});
	});

	it("is a no-op (no command) when the box contains nothing", () => {
		const h = makeHarness([structuredClone(tilemap)]);
		eraseRangeBox(
			{ store: h.store, commands: h.commands, tile: 40 },
			{ minC: 100, minR: 100, maxC: 110, maxR: 110 },
			{ terrain: true },
		);
		expect(h.getLast()).toBeNull();
	});

	it("no-ops when the terrain target is off", () => {
		const h = makeHarness([structuredClone(tilemap)]);
		eraseRangeBox(
			{ store: h.store, commands: h.commands, tile: 40 },
			{ minC: 0, minR: 0, maxC: 9, maxR: 9 },
			{ terrain: false },
		);
		expect(h.getLast()).toBeNull();
	});

	it("only targets the first tilemap (single shared substrate)", () => {
		const other = {
			id: "tm2",
			type: "tilemap",
			tile: 40,
			cells: { "0,0": "forest" },
		} as unknown as ShapeData;
		const h = makeHarness([structuredClone(tilemap), other]);
		eraseRangeBox(
			{ store: h.store, commands: h.commands, tile: 40 },
			{ minC: 0, minR: 0, maxC: 0, maxR: 0 },
			{ terrain: true },
		);
		// The second tilemap is untouched.
		expect((h.shapes.get("tm2") as { cells: Record<string, string> }).cells).toEqual({
			"0,0": "forest",
		});
	});
});
