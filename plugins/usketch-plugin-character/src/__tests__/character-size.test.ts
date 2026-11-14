import { describe, expect, it } from "vitest";
import { characterSizePx, DEFAULT_SIZE, sanitizeSize } from "../character-size.js";
import { createCharacterStore } from "../character-store.js";

describe("character size", () => {
	it("defaults to 36 px on screen at every zoom", () => {
		const size = createCharacterStore().getState().size;
		expect(size).toEqual(DEFAULT_SIZE);
		expect(characterSizePx(size, 0.25)).toBe(36);
		expect(characterSizePx(size, 4)).toBe(36);
	});

	it("scales a world size with the zoom, within minPx … maxPx", () => {
		const size = sanitizeSize({ scale: "world", value: 24, minPx: 20, maxPx: 60 });
		expect(characterSizePx(size, 1)).toBe(24);
		expect(characterSizePx(size, 2)).toBe(48);
		expect(characterSizePx(size, 0.5)).toBe(20); // 12 → minPx
		expect(characterSizePx(size, 4)).toBe(60); // 96 → maxPx
	});

	it("treats a broken zoom as 1", () => {
		const size = sanitizeSize({ scale: "world", value: 24 });
		expect(characterSizePx(size, 0)).toBe(24);
		expect(characterSizePx(size, Number.NaN)).toBe(24);
	});

	it("keeps bad values out", () => {
		const size = sanitizeSize({
			scale: "huge" as never,
			value: Number.NaN,
			minPx: 50,
			maxPx: 10,
		});
		expect(size.scale).toBe(DEFAULT_SIZE.scale);
		expect(size.value).toBe(DEFAULT_SIZE.value);
		expect(size.maxPx).toBe(50); // never below minPx
		expect(sanitizeSize({ value: -5 }).value).toBe(1);
	});

	it("setSize changes only the given fields", () => {
		const store = createCharacterStore({ size: { scale: "world", value: 24 } });
		store.setSize({ value: 30 });
		expect(store.getState().size).toMatchObject({ scale: "world", value: 30 });
		store.setSize({ scale: "screen" });
		expect(store.getState().size).toMatchObject({ scale: "screen", value: 30 });
	});
});
