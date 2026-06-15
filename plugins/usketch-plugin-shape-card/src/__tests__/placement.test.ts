import { describe, expect, it } from "vitest";
import { resolvePlacementAnimation } from "../placement.js";

describe("resolvePlacementAnimation", () => {
	it("returns null for the 'none' preset", () => {
		expect(resolvePlacementAnimation({ preset: "none" }, undefined)).toBeNull();
	});

	it("resolves keyframe presets to css with a duration", () => {
		const r = resolvePlacementAnimation({ preset: "drop" }, undefined);
		expect(r).toMatchObject({ kind: "css", name: "usketch-card-drop" });
		expect((r as { durationMs: number }).durationMs).toBeGreaterThan(0);
	});

	it("resolves slam presets to a slam kind with the weight", () => {
		expect(resolvePlacementAnimation({ preset: "slam-light" }, undefined)).toMatchObject({
			kind: "slam",
			weight: "light",
		});
		expect(resolvePlacementAnimation({ preset: "slam-heavy" }, undefined)).toMatchObject({
			kind: "slam",
			weight: "heavy",
		});
	});

	it("makes heavier slams slower (longer duration)", () => {
		const light = resolvePlacementAnimation({ preset: "slam-light" }, undefined) as {
			durationMs: number;
		};
		const medium = resolvePlacementAnimation({ preset: "slam-medium" }, undefined) as {
			durationMs: number;
		};
		const heavy = resolvePlacementAnimation({ preset: "slam-heavy" }, undefined) as {
			durationMs: number;
		};
		expect(light.durationMs).toBeLessThan(medium.durationMs);
		expect(medium.durationMs).toBeLessThan(heavy.durationMs);
	});

	it("prefers the card-type animation over the plugin default", () => {
		const r = resolvePlacementAnimation({ preset: "slam-heavy" }, { preset: "drop" });
		expect(r).toMatchObject({ kind: "slam", weight: "heavy" });
	});

	it("falls back to the plugin default, then to drop", () => {
		expect(resolvePlacementAnimation(undefined, { preset: "bounce" })).toMatchObject({
			name: "usketch-card-bounce",
		});
		expect(resolvePlacementAnimation(undefined, undefined)).toMatchObject({
			name: "usketch-card-drop",
		});
	});
});
