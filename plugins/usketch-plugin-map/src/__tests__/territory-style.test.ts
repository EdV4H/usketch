import { describe, expect, it } from "vitest";
import { DEFAULT_TERRITORY_STYLE, resolveTerritoryStyle } from "../base/territory-style.js";

describe("resolveTerritoryStyle", () => {
	it("returns defaults for undefined / empty", () => {
		expect(resolveTerritoryStyle()).toEqual(DEFAULT_TERRITORY_STYLE);
		expect(resolveTerritoryStyle({})).toEqual(DEFAULT_TERRITORY_STYLE);
	});

	it("merges nested groups over the defaults, keeping untouched fields", () => {
		const r = resolveTerritoryStyle({ fillOpacity: 0.5, ring: { enabled: false } });
		expect(r.fillOpacity).toBe(0.5);
		expect(r.ring.enabled).toBe(false);
		// untouched ring fields keep defaults
		expect(r.ring.dash).toBe(DEFAULT_TERRITORY_STYLE.ring.dash);
		expect(r.ring.strokeWidth).toBe(DEFAULT_TERRITORY_STYLE.ring.strokeWidth);
		// untouched groups unchanged
		expect(r.border).toEqual(DEFAULT_TERRITORY_STYLE.border);
	});

	it("keeps defaults when an override field is explicitly undefined (no NaN)", () => {
		const r = resolveTerritoryStyle({ border: { ratio: undefined, opacity: 0.5 } });
		expect(r.border.ratio).toBe(DEFAULT_TERRITORY_STYLE.border.ratio);
		expect(r.border.opacity).toBe(0.5);
	});

	it("carries the label render override and the show mode", () => {
		const render = () => null;
		const r = resolveTerritoryStyle({ label: { render }, show: "always" });
		expect(r.label.render).toBe(render);
		expect(r.label.enabled).toBe(true); // default kept
		expect(r.show).toBe("always");
	});

	it("does not mutate the shared default object", () => {
		resolveTerritoryStyle({ ring: { enabled: false } });
		expect(DEFAULT_TERRITORY_STYLE.ring.enabled).toBe(true);
	});
});
