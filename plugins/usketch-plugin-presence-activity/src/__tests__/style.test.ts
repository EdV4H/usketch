import { describe, expect, it } from "vitest";
import { DEFAULT_ACTIVITY_STYLE, resolveActivityStyle } from "../style.js";

describe("resolveActivityStyle", () => {
	it("returns the defaults when nothing is passed", () => {
		expect(resolveActivityStyle()).toEqual(DEFAULT_ACTIVITY_STYLE);
		expect(resolveActivityStyle({})).toEqual(DEFAULT_ACTIVITY_STYLE);
	});

	it("shallow-merges each group over the defaults (partial overrides keep siblings)", () => {
		const r = resolveActivityStyle({ outline: { strokeWidth: 5, pulse: false } });
		expect(r.outline.strokeWidth).toBe(5);
		expect(r.outline.pulse).toBe(false);
		// untouched outline fields keep defaults
		expect(r.outline.padding).toBe(DEFAULT_ACTIVITY_STYLE.outline.padding);
		expect(r.outline.radius).toBe(DEFAULT_ACTIVITY_STYLE.outline.radius);
		// untouched groups are unchanged
		expect(r.marquee).toEqual(DEFAULT_ACTIVITY_STYLE.marquee);
		expect(r.badge).toEqual(DEFAULT_ACTIVITY_STYLE.badge);
	});

	it("keeps the default when an override field is explicitly undefined (no NaN)", () => {
		const r = resolveActivityStyle({ outline: { padding: undefined, strokeWidth: 4 } });
		expect(r.outline.padding).toBe(DEFAULT_ACTIVITY_STYLE.outline.padding); // not undefined/NaN
		expect(r.outline.strokeWidth).toBe(4);
	});

	it("overrides the local-AI identity", () => {
		const r = resolveActivityStyle({ aiParticipant: { label: "Copilot", color: "#0ea5e9" } });
		expect(r.aiParticipant).toEqual({ label: "Copilot", color: "#0ea5e9" });
	});

	it("carries a renderParticipant override through", () => {
		const fn = () => null;
		expect(resolveActivityStyle({ renderParticipant: fn }).renderParticipant).toBe(fn);
		expect(resolveActivityStyle().renderParticipant).toBeUndefined();
	});

	it("does not mutate the shared default object", () => {
		resolveActivityStyle({ badge: { enabled: false } });
		expect(DEFAULT_ACTIVITY_STYLE.badge.enabled).toBe(true);
	});
});
