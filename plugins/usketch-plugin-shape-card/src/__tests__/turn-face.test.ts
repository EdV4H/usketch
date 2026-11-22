import { describe, expect, it } from "vitest";
import { createBareCardShape, DECK_TYPE } from "../factory.js";
import { cardTurnFace } from "../turn-face.js";

describe("cardTurnFace", () => {
	it("turns a face-up card down and leaves a face-down one alone", () => {
		const card = createBareCardShape({ x: 0, y: 0 });
		const patch = cardTurnFace(card, "down");
		expect(patch?.meta).toMatchObject({ isFlipped: true, cardType: card.meta?.cardType });
		expect(cardTurnFace(card, "up")).toBeNull();
		expect(cardTurnFace({ ...card, ...patch } as typeof card, "down")).toBeNull();
	});

	it("turns a deck with faceDown", () => {
		const deck = {
			...createBareCardShape({ x: 0, y: 0 }),
			type: DECK_TYPE,
			meta: { cardType: "x", cards: [], faceDown: true },
		};
		expect(cardTurnFace(deck, "down")).toBeNull();
		expect(cardTurnFace(deck, "up")?.meta).toMatchObject({ faceDown: false });
	});

	it("ignores other shapes", () => {
		expect(
			cardTurnFace({ id: "r", type: "rect", x: 0, y: 0, width: 1, height: 1 } as never, "down"),
		).toBeNull();
	});
});
