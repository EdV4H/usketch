import type { ShapeData } from "@edv4h/usketch-shared";
import { describe, expect, it } from "vitest";
import { cardMenuKind } from "../card-action-menu.js";
import { CARD_TYPE, DECK_TYPE } from "../factory.js";

function shape(id: string, type: string, meta: Record<string, unknown> = {}): ShapeData {
	return { id, type, x: 0, y: 0, width: 10, height: 10, style: {}, meta } as ShapeData;
}

function map(...ss: ShapeData[]) {
	return new Map(ss.map((s) => [s.id, s]));
}

describe("cardMenuKind", () => {
	it("returns null when selection is not exactly one", () => {
		const shapes = map(shape("a", CARD_TYPE, { cardType: "x" }));
		expect(cardMenuKind(shapes, [], true)).toBeNull();
		expect(cardMenuKind(shapes, ["a", "b"], true)).toBeNull();
	});

	it("returns card kind with canHand=true for a typed card", () => {
		const shapes = map(shape("a", CARD_TYPE, { cardType: "playing-card" }));
		expect(cardMenuKind(shapes, ["a"], true)).toEqual({ kind: "card", id: "a", canHand: true });
	});

	it("card without cardType (bare) cannot go to hand", () => {
		const shapes = map(shape("a", CARD_TYPE, { cardType: "" }));
		expect(cardMenuKind(shapes, ["a"], true)?.canHand).toBe(false);
	});

	it("returns deck kind only when enableDeck", () => {
		const shapes = map(shape("d", DECK_TYPE, { cardType: "playing-card" }));
		expect(cardMenuKind(shapes, ["d"], true)).toEqual({ kind: "deck", id: "d", canHand: false });
		expect(cardMenuKind(shapes, ["d"], false)).toBeNull();
	});

	it("returns null for non-card shapes", () => {
		const shapes = map(shape("r", "rectangle"));
		expect(cardMenuKind(shapes, ["r"], true)).toBeNull();
	});
});
