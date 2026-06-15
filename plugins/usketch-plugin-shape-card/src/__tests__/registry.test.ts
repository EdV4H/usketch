import { describe, expect, it } from "vitest";
import { BUILTIN_CARD_TYPES, createCardTypeRegistry } from "../registry.js";
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
	it("includes all built-in card types by default", () => {
		const reg = createCardTypeRegistry();
		for (const def of BUILTIN_CARD_TYPES) {
			expect(reg.get(def.id)).toBe(def);
		}
	});

	it("merges extra card types", () => {
		const reg = createCardTypeRegistry([dummy]);
		expect(reg.get("dummy")).toBe(dummy);
		expect(reg.size).toBe(BUILTIN_CARD_TYPES.length + 1);
	});

	it("lets extra card types override built-ins with the same id", () => {
		const override: CardTypeDefinition = { ...dummy, id: "media", label: "Custom" };
		const reg = createCardTypeRegistry([override]);
		expect(reg.get("media")).toBe(override);
		expect(reg.size).toBe(BUILTIN_CARD_TYPES.length);
	});
});
