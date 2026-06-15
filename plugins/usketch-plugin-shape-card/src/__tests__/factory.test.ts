import { describe, expect, it } from "vitest";
import { CARD_TYPE, createCardShape, createDeckShape, DECK_TYPE } from "../factory.js";
import type { CardTypeDefinition } from "../types.js";

const def: CardTypeDefinition = {
	id: "tcg",
	label: "TCG",
	aspectRatio: 110 / 150,
	defaultSize: { width: 110, height: 150 },
	icon: () => null as never,
	createDefaultFields: () => ({ name: "default" }),
	renderFront: () => null as never,
	renderBack: () => null as never,
	buildDeck: () => [{ name: "starter-a" }, { name: "starter-b" }],
};

describe("createCardShape", () => {
	it("builds a card shape from the card-type defaults", () => {
		const card = createCardShape(def, { x: 10, y: 20 });
		expect(card.type).toBe(CARD_TYPE);
		expect(card).toMatchObject({ x: 10, y: 20, width: 110, height: 150 });
		expect(card.meta).toEqual({ cardType: "tcg", isFlipped: false, fields: { name: "default" } });
		expect(card.id).toBeTruthy();
	});

	it("accepts explicit fields / size / zIndex overrides", () => {
		const card = createCardShape(def, {
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			fields: { name: "fireball" },
			zIndex: "a5",
		});
		expect(card).toMatchObject({ width: 0, height: 0, zIndex: "a5" });
		expect(card.meta?.fields).toEqual({ name: "fireball" });
	});
});

describe("createDeckShape", () => {
	it("uses buildDeck() when no cards are given", () => {
		const deck = createDeckShape(def, { x: 0, y: 0 });
		expect(deck.type).toBe(DECK_TYPE);
		expect(deck.meta?.cards).toEqual([{ name: "starter-a" }, { name: "starter-b" }]);
		expect(deck.meta?.faceDown).toBe(true);
	});

	it("accepts an explicit (variable / TCG) card list", () => {
		const cards = [{ name: "x" }, { name: "y" }, { name: "z" }];
		const deck = createDeckShape(def, { x: 0, y: 0, cards, faceDown: false });
		expect(deck.meta?.cards).toBe(cards);
		expect(deck.meta?.faceDown).toBe(false);
	});
});
