import { ELEVATION_FIELD_ID, getElevationField } from "@edv4h/usketch-plugin-elevation";
import { createBoardStore } from "@edv4h/usketch-store";
import { describe, expect, it } from "vitest";
import { ELEVATION_REGIONS, ensureRegionTerrain } from "../community-terrain.js";

describe("ensureRegionTerrain", () => {
	it("puts an infinite terrain on an elevation region without a field", () => {
		const store = createBoardStore();
		expect(ensureRegionTerrain(store, "playground")).toBe(true);
		const field = getElevationField(store);
		expect(field?.seed).toBe(ELEVATION_REGIONS.playground?.seed);
		expect(field?.waterLevel).toBeGreaterThan(0);
		expect(store.getShapes().has(ELEVATION_FIELD_ID)).toBe(true);
	});

	it("keeps an existing field as it is", () => {
		const store = createBoardStore();
		ensureRegionTerrain(store, "playground");
		store.updateShape(ELEVATION_FIELD_ID, { seed: 7 } as never);
		expect(ensureRegionTerrain(store, "playground")).toBe(false);
		expect(getElevationField(store)?.seed).toBe(7);
	});

	it("leaves other regions alone", () => {
		const store = createBoardStore();
		expect(ensureRegionTerrain(store, "lobby")).toBe(false);
		expect(getElevationField(store)).toBeNull();
	});
});
