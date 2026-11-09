import { createCommandRegistry } from "@edv4h/usketch-core";
import { describe, expect, it } from "vitest";
import { encodeChunk } from "../elevation-codec.js";
import { chunkShapeId, ELEVATION_FIELD_ID, isElevationChunk } from "../elevation-field.js";
import { boardElevation, elevationHeightAt } from "../elevation-model.js";
import {
	editedChunkCount,
	enableInfiniteElevation,
	getElevationField,
	paintElevation,
	writeChunkEdits,
} from "../elevation-ops.js";
import { fakeStore } from "./helpers.js";

function setup() {
	const store = fakeStore();
	const commands = createCommandRegistry();
	return { store, commands, deps: { store, commands } };
}

const filled = (v: number) => new Int16Array(1024).fill(v);

describe("writeChunkEdits", () => {
	it("creates a flat field on a bare board, in the same undo step", () => {
		const { store, commands, deps } = setup();
		writeChunkEdits(deps, [{ cx: 0, cy: 0, values: filled(40) }]);
		expect(getElevationField(store)).toMatchObject({ id: ELEVATION_FIELD_ID, seed: null });
		expect(elevationHeightAt(store, 100, 100)).toBe(10);
		commands.undo();
		expect(store.getShapes().size).toBe(0);
		commands.redo();
		expect(editedChunkCount(store)).toBe(1);
	});

	it("adds, updates and removes chunks, and undo puts each back", () => {
		const { store, commands, deps } = setup();
		writeChunkEdits(deps, [
			{ cx: 0, cy: 0, values: filled(4) },
			{ cx: 1, cy: 0, values: filled(8) },
		]);
		writeChunkEdits(deps, [
			{ cx: 0, cy: 0, values: filled(12) },
			{ cx: 1, cy: 0, values: null },
		]);
		expect(editedChunkCount(store)).toBe(1);
		expect(elevationHeightAt(store, 10, 10)).toBe(3);
		commands.undo();
		expect(editedChunkCount(store)).toBe(2);
		expect(elevationHeightAt(store, 10, 10)).toBe(1);
		expect(elevationHeightAt(store, 600, 10)).toBe(2);
	});

	it("undo leaves alone a chunk someone else changed since", () => {
		const { store, commands, deps } = setup();
		writeChunkEdits(deps, [
			{ cx: 0, cy: 0, values: filled(4) },
			{ cx: 1, cy: 0, values: filled(4) },
		]);
		writeChunkEdits(deps, [
			{ cx: 0, cy: 0, values: filled(20) },
			{ cx: 1, cy: 0, values: filled(20) },
		]);
		// Another client paints chunk (1,0) after us (arrives as a plain store write).
		store.updateShape(chunkShapeId(ELEVATION_FIELD_ID, 1, 0), {
			data: encodeChunk(filled(99)),
		} as never);
		commands.undo();
		expect(elevationHeightAt(store, 10, 10)).toBe(1); // ours: undone
		expect(elevationHeightAt(store, 600, 10)).toBe(99 / 4); // theirs: kept
	});

	it("undo keeps a field it created once someone else painted on it", () => {
		const { store, commands, deps } = setup();
		writeChunkEdits(deps, [{ cx: 0, cy: 0, values: filled(4) }]);
		const other = { ...store.getShape(chunkShapeId(ELEVATION_FIELD_ID, 0, 0)) };
		store.addShape({ ...other, id: chunkShapeId(ELEVATION_FIELD_ID, 5, 5), cx: 5, cy: 5 } as never);
		commands.undo();
		expect(getElevationField(store)).not.toBeNull();
		expect(editedChunkCount(store)).toBe(1);
	});
});

describe("paintElevation", () => {
	it("one stroke along a path is one undo step", () => {
		const { store, commands, deps } = setup();
		enableInfiniteElevation(deps, { seed: 2 });
		const h0 = elevationHeightAt(store, 0, 0);
		const n = paintElevation(
			deps,
			[
				{ x: 0, y: 0 },
				{ x: 600, y: 0 },
			],
			{ brush: { radius: 64, strength: 50 }, seconds: 1 },
		);
		expect(n).toBeGreaterThanOrEqual(2);
		expect(elevationHeightAt(store, 0, 0)).toBeGreaterThan(h0);
		commands.undo();
		expect(elevationHeightAt(store, 0, 0)).toBe(h0);
		expect([...store.getShapes().values()].some(isElevationChunk)).toBe(false);
	});

	it("flatten without a height levels to the height under the first point", () => {
		const { store, deps } = setup();
		paintElevation(deps, [{ x: 0, y: 0 }], {
			brush: { radius: 200, falloff: "flat" },
			seconds: 0.5,
		});
		const top = elevationHeightAt(store, 0, 0);
		paintElevation(deps, [{ x: 400, y: 0 }], {
			brush: { radius: 100, falloff: "flat" },
			seconds: 1,
		});
		paintElevation(
			deps,
			[
				{ x: 0, y: 0 },
				{ x: 400, y: 0 },
			],
			{
				mode: "flatten",
				brush: { radius: 64, strength: 100, falloff: "flat" },
				seconds: 4,
			},
		);
		expect(elevationHeightAt(store, 400, 0)).toBeCloseTo(top, 0);
		expect(boardElevation(store)?.field.id).toBe(ELEVATION_FIELD_ID);
	});
});
