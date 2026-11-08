import { describe, expect, it } from "vitest";
import { FULL_MIN_PX } from "../lod.js";
import {
	clampGroundOverscan,
	DEFAULT_FULL_DETAIL_MIN_PX,
	DEFAULT_GROUND_OVERSCAN_MAX_PX,
	DEFAULT_RELIEF_EDGE_INSET,
	detailConfigPatch,
	type MapRenderConfig,
	renderConfigStore,
} from "../render-config.js";

const base: MapRenderConfig = {
	colorMode: "color",
	lineStyle: "wobble",
	strokeScale: 1,
	emptyTerrain: null,
	groundOverscanMaxPx: 160,
	reliefOverscan: false,
	reliefEdgeInset: 2,
	fullDetailMinPx: 24,
	heightEnabled: true,
};

describe("render config defaults", () => {
	it("keep the original draw range / detail", () => {
		const cfg = renderConfigStore.get();
		expect(cfg.groundOverscanMaxPx).toBe(DEFAULT_GROUND_OVERSCAN_MAX_PX);
		expect(DEFAULT_GROUND_OVERSCAN_MAX_PX).toBe(160);
		expect(cfg.reliefOverscan).toBe(false);
		expect(cfg.reliefEdgeInset).toBe(DEFAULT_RELIEF_EDGE_INSET);
		expect(DEFAULT_RELIEF_EDGE_INSET).toBe(2);
		expect(cfg.fullDetailMinPx).toBe(DEFAULT_FULL_DETAIL_MIN_PX);
		expect(DEFAULT_FULL_DETAIL_MIN_PX).toBe(FULL_MIN_PX);
	});
});

describe("clampGroundOverscan", () => {
	it("caps the requested px at the max", () => {
		expect(clampGroundOverscan(600, 160)).toBe(160);
		expect(clampGroundOverscan(100, 160)).toBe(100);
		expect(clampGroundOverscan(600, 1000)).toBe(600);
	});
	it("treats junk / negatives as 0", () => {
		expect(clampGroundOverscan(Number.NaN, 160)).toBe(0);
		expect(clampGroundOverscan(-20, 160)).toBe(0);
		expect(clampGroundOverscan(300, -5)).toBe(0);
		expect(clampGroundOverscan(300, Number.POSITIVE_INFINITY)).toBe(0);
	});
});

describe("detailConfigPatch", () => {
	it("coerces the numeric fields and keeps them in range", () => {
		expect(detailConfigPatch("groundOverscanMaxPx", "480.4", base)).toEqual({
			groundOverscanMaxPx: 480,
		});
		expect(detailConfigPatch("groundOverscanMaxPx", -10, base)).toEqual({ groundOverscanMaxPx: 0 });
		expect(detailConfigPatch("reliefEdgeInset", 3.7, base)).toEqual({ reliefEdgeInset: 3 });
		expect(detailConfigPatch("fullDetailMinPx", 0, base)).toEqual({ fullDetailMinPx: 1 });
		expect(detailConfigPatch("fullDetailMinPx", 40, base)).toEqual({ fullDetailMinPx: 40 });
	});
	it("falls back to the current value on junk", () => {
		expect(detailConfigPatch("groundOverscanMaxPx", "abc", base)).toEqual({
			groundOverscanMaxPx: 160,
		});
		expect(detailConfigPatch("reliefEdgeInset", undefined, base)).toEqual({ reliefEdgeInset: 2 });
	});
	it("reads booleans from HUD values", () => {
		expect(detailConfigPatch("reliefOverscan", true, base)).toEqual({ reliefOverscan: true });
		expect(detailConfigPatch("reliefOverscan", "true", base)).toEqual({ reliefOverscan: true });
		expect(detailConfigPatch("reliefOverscan", false, base)).toEqual({ reliefOverscan: false });
	});
	it("ignores other fields", () => {
		expect(detailConfigPatch("strokeScale", 2, base)).toBeNull();
		expect(detailConfigPatch("colorMode", "mono", base)).toBeNull();
	});
});
