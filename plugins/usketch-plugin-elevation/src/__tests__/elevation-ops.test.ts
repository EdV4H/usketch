import { createCommandRegistry } from "@edv4h/usketch-core";
import { describe, expect, it } from "vitest";
import { encodeChunk } from "../elevation-codec.js";
import { DEFAULT_GEN, makeChunkShape, normalizeField } from "../elevation-field.js";
import {
	clearElevationEdits,
	disableInfiniteElevation,
	editedChunkCount,
	enableInfiniteElevation,
	getElevationField,
	removeElevationField,
} from "../elevation-ops.js";
import { fakeStore } from "./helpers.js";

function setup() {
	const store = fakeStore();
	const commands = createCommandRegistry();
	return { store, commands, deps: { store, commands } };
}

describe("enableInfiniteElevation", () => {
	it("creates the field with the seed, frozen parameters and water — one undo step", () => {
		const { store, commands, deps } = setup();
		expect(enableInfiniteElevation(deps, { seed: 7 })).toBe(7);
		const f = getElevationField(store);
		expect(f).toMatchObject({ seed: 7, gen: DEFAULT_GEN, waterLevel: 48 });
		commands.undo();
		expect(getElevationField(store)).toBeNull();
	});

	it("changes only the given parameters and keeps the rest", () => {
		const { store, commands, deps } = setup();
		enableInfiniteElevation(deps, { seed: 1, gen: { relief: 500 }, waterLevel: 10 });
		enableInfiniteElevation(deps, { gen: { scale: 4096, roughness: undefined } });
		expect(getElevationField(store)).toMatchObject({
			seed: 1,
			gen: { ...DEFAULT_GEN, relief: 500, scale: 4096 },
			waterLevel: 10,
		});
		commands.undo();
		expect(getElevationField(store)?.gen.scale).toBe(DEFAULT_GEN.scale);
	});

	it("takes null for no water, and rejects a non-integer seed", () => {
		const { store, deps } = setup();
		enableInfiniteElevation(deps, { seed: 2, waterLevel: null });
		expect(getElevationField(store)?.waterLevel).toBeNull();
		expect(() => enableInfiniteElevation(deps, { seed: 1.5 })).toThrow(RangeError);
	});
});

describe("disable / clear / remove", () => {
	it("turns the generated terrain off but keeps the edits", () => {
		const { store, commands, deps } = setup();
		enableInfiniteElevation(deps, { seed: 3 });
		const cfg = normalizeField(store.getShapes().values().next().value as never);
		store.addShape(makeChunkShape(cfg, 0, 0, encodeChunk(new Int16Array(1024).fill(8))));
		disableInfiniteElevation(deps);
		expect(getElevationField(store)?.seed).toBeNull();
		expect(editedChunkCount(store)).toBe(1);
		commands.undo();
		expect(getElevationField(store)?.seed).toBe(3);
	});

	it("clears the edits, and removes the field with them, each undoable", () => {
		const { store, commands, deps } = setup();
		enableInfiniteElevation(deps, { seed: 3 });
		const cfg = normalizeField(store.getShapes().values().next().value as never);
		const data = encodeChunk(new Int16Array(1024).fill(8));
		store.addShape(makeChunkShape(cfg, 0, 0, data));
		store.addShape(makeChunkShape(cfg, 1, 0, data));
		clearElevationEdits(deps);
		expect(editedChunkCount(store)).toBe(0);
		commands.undo();
		expect(editedChunkCount(store)).toBe(2);
		removeElevationField(deps);
		expect(store.getShapes().size).toBe(0);
		commands.undo();
		expect(getElevationField(store)?.seed).toBe(3);
		expect(editedChunkCount(store)).toBe(2);
	});

	it("writes straight to the store without a command registry", () => {
		const store = fakeStore();
		enableInfiniteElevation({ store }, { seed: 4 });
		expect(getElevationField(store)?.seed).toBe(4);
	});
});
