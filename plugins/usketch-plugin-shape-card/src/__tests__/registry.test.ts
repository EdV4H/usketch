import { describe, expect, it } from "vitest";
import { createCardTypeRegistry, EXAMPLE_CARD_TYPES } from "../registry.js";
import type { CardTypeDefinition } from "../types.js";

const dummy: CardTypeDefinition = {
	id: "dummy",
	label: "Dummy",
	aspectRatio: 1,
	defaultSize: { width: 100, height: 100 },
	icon: () => null as never,
	createDefaultFields: () => ({}),
	renderFront: () => null as never,
	renderBack: () => null as never,
};

describe("createCardTypeRegistry", () => {
	it("is empty by default (built-ins are NOT auto-registered)", () => {
		expect(createCardTypeRegistry().size).toBe(0);
	});

	it("registers only the card types passed in", () => {
		const reg = createCardTypeRegistry([dummy]);
		expect(reg.get("dummy")).toBe(dummy);
		expect(reg.size).toBe(1);
	});

	it("can opt into the example card types explicitly", () => {
		const reg = createCardTypeRegistry(EXAMPLE_CARD_TYPES);
		expect(reg.size).toBe(EXAMPLE_CARD_TYPES.length);
		for (const def of EXAMPLE_CARD_TYPES) {
			expect(reg.get(def.id)).toBe(def);
		}
	});

	it("later entries override earlier ones with the same id", () => {
		const override: CardTypeDefinition = { ...dummy, id: "media", label: "Custom" };
		const reg = createCardTypeRegistry([...EXAMPLE_CARD_TYPES, override]);
		expect(reg.get("media")).toBe(override);
		expect(reg.size).toBe(EXAMPLE_CARD_TYPES.length);
	});
});
