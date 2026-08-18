import { describe, expect, it } from "vitest";
import { DEFAULT_TERRITORY_STYLE, resolveTerritoryStyle } from "../base/territory-style.js";

describe("resolveTerritoryStyle (headless)", () => {
	it("returns defaults for undefined / empty (no render hooks, base-mode)", () => {
		expect(resolveTerritoryStyle()).toEqual(DEFAULT_TERRITORY_STYLE);
		expect(resolveTerritoryStyle({})).toEqual(DEFAULT_TERRITORY_STYLE);
		expect(DEFAULT_TERRITORY_STYLE.region.render).toBeUndefined();
		expect(DEFAULT_TERRITORY_STYLE.label.render).toBeUndefined();
		expect(DEFAULT_TERRITORY_STYLE.enterBanner.render).toBeUndefined();
		expect(DEFAULT_TERRITORY_STYLE.show).toBe("base-mode");
	});

	it("carries the region + label + enterBanner render hooks and the show mode", () => {
		const region = () => null;
		const label = () => null;
		const enterBanner = () => null;
		const r = resolveTerritoryStyle({
			region: { render: region },
			label: { render: label },
			enterBanner: { render: enterBanner },
			show: "always",
		});
		expect(r.region.render).toBe(region);
		expect(r.label.render).toBe(label);
		expect(r.enterBanner.render).toBe(enterBanner);
		expect(r.show).toBe("always");
	});

	it("defaults show to base-mode when only a render hook is given", () => {
		const r = resolveTerritoryStyle({ region: { render: () => null } });
		expect(r.show).toBe("base-mode");
	});

	it("does not mutate the shared default object", () => {
		resolveTerritoryStyle({ region: { render: () => null }, show: "always" });
		expect(DEFAULT_TERRITORY_STYLE.region.render).toBeUndefined();
		expect(DEFAULT_TERRITORY_STYLE.show).toBe("base-mode");
	});
});
