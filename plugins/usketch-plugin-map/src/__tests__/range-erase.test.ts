import type { BoardStore, Command, CommandRegistry, ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { eraseRangeBox } from "../range-erase.js";

// Minimal in-memory store + command capture (eraseRangeBox only uses getShapes /
// updateShape / commands.execute).
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
const teammap = {
	id: "tt",
	type: "team-map",
	tile: 40,
	teams: {},
	owner: { "0,0": "red", "5,5": "red" },
} as unknown as ShapeData;

const ALL = { terrain: true, team: true };

describe("eraseRangeBox", () => {
	it("clears terrain + team ownership inside the box, and undo restores both", () => {
		const h = makeHarness([structuredClone(tilemap), structuredClone(teammap)]);
		eraseRangeBox(
			{ store: h.store, commands: h.commands, tile: 40 },
			{ minC: 0, minR: 0, maxC: 2, maxR: 2 }, // covers cell 0,0 but not 5,5
			ALL,
		);
		expect((h.shapes.get("tm") as { cells: Record<string, string> }).cells).toEqual({
			"5,5": "grass",
		});
		expect((h.shapes.get("tt") as { owner: Record<string, string> }).owner).toEqual({
			"5,5": "red",
		});

		h.getLast()?.undo();
		expect((h.shapes.get("tm") as { cells: Record<string, string> }).cells).toEqual({
			"0,0": "grass",
			"5,5": "grass",
		});
		expect((h.shapes.get("tt") as { owner: Record<string, string> }).owner).toEqual({
			"0,0": "red",
			"5,5": "red",
		});
	});

	it("is a no-op (no command) when the box contains nothing", () => {
		const h = makeHarness([structuredClone(tilemap)]);
		eraseRangeBox(
			{ store: h.store, commands: h.commands, tile: 40 },
			{ minC: 100, minR: 100, maxC: 110, maxR: 110 },
			ALL,
		);
		expect(h.getLast()).toBeNull();
	});

	it("honours the target selection (team-only leaves terrain intact)", () => {
		const h = makeHarness([structuredClone(tilemap), structuredClone(teammap)]);
		eraseRangeBox(
			{ store: h.store, commands: h.commands, tile: 40 },
			{ minC: 0, minR: 0, maxC: 2, maxR: 2 },
			{ terrain: false, team: true },
		);
		// terrain untouched, team cleared in box
		expect((h.shapes.get("tm") as { cells: Record<string, string> }).cells).toEqual({
			"0,0": "grass",
			"5,5": "grass",
		});
		expect((h.shapes.get("tt") as { owner: Record<string, string> }).owner).toEqual({
			"5,5": "red",
		});
	});

	it("no-ops when no target is selected", () => {
		const h = makeHarness([structuredClone(tilemap), structuredClone(teammap)]);
		eraseRangeBox(
			{ store: h.store, commands: h.commands, tile: 40 },
			{ minC: 0, minR: 0, maxC: 9, maxR: 9 },
			{ terrain: false, team: false },
		);
		expect(h.getLast()).toBeNull();
	});

	it("only targets the first tilemap / team-map (single shared substrate)", () => {
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
			ALL,
		);
		// The second tilemap is untouched.
		expect((h.shapes.get("tm2") as { cells: Record<string, string> }).cells).toEqual({
			"0,0": "forest",
		});
	});
});
