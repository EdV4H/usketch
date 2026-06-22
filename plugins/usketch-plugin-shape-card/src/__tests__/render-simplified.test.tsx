import type { ShapeData } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { CARD_TYPE, DECK_TYPE } from "../factory.js";
import { createCardSimplified, createDeckSimplified } from "../render-simplified.js";
import type { CardTypeDefinition } from "../types.js";

function makeCardType(id: string, withSimplified: boolean): CardTypeDefinition {
	return {
		id,
		label: id,
		aspectRatio: 2 / 3,
		defaultSize: { width: 100, height: 150 },
		icon: () => null as never,
		createDefaultFields: () => ({ label: "DEF" }),
		renderFront: () => null as never,
		renderBack: () => null as never,
		...(withSimplified
			? {
					renderSimplified: (fields: Record<string, unknown>) =>
						(<span data-kind="simplified">{String(fields.label)}</span>) as ReactElement,
				}
			: {}),
	};
}

function registry(...defs: CardTypeDefinition[]): Map<string, CardTypeDefinition> {
	return new Map(defs.map((d) => [d.id, d]));
}

function cardShape(cardType: string, fields?: Record<string, unknown>): ShapeData {
	return {
		id: "c1",
		type: CARD_TYPE,
		x: 12,
		y: 34,
		width: 100,
		height: 150,
		style: { fill: "#abcdef", stroke: "#000", strokeWidth: 1, opacity: 1 },
		meta: { cardType, isFlipped: false, fields: fields ?? { label: "ACE" } },
	} as ShapeData;
}

describe("createCardSimplified", () => {
	it("positions a card frame in world coords and renders the card-type's content", () => {
		const Comp = createCardSimplified(registry(makeCardType("media", true)));
		const el = Comp({ shape: cardShape("media") }) as ReactElement<Record<string, unknown>>;
		const style = el.props.style as Record<string, unknown>;
		expect(style.left).toBe(12);
		expect(style.top).toBe(34);
		expect(style.width).toBe(100);
		expect(style.height).toBe(150);
		expect(style.position).toBe("absolute");
		// No gray fill when card-type provides its own simplified content.
		expect(style.backgroundColor).toBeUndefined();
		const inner = el.props.children as ReactElement<Record<string, unknown>>;
		expect(inner.props["data-kind"]).toBe("simplified");
		expect(inner.props.children).toBe("ACE");
	});

	it("falls back to a fill rect when the card-type has no renderSimplified", () => {
		const Comp = createCardSimplified(registry(makeCardType("plain", false)));
		const el = Comp({ shape: cardShape("plain") }) as ReactElement<Record<string, unknown>>;
		const style = el.props.style as Record<string, unknown>;
		expect(style.backgroundColor).toBe("#abcdef");
		expect(el.props.children).toBeUndefined();
	});

	it("falls back to default gray when style.fill and renderSimplified are absent", () => {
		const Comp = createCardSimplified(registry(makeCardType("plain", false)));
		const shape = { ...cardShape("plain"), style: undefined } as unknown as ShapeData;
		const el = Comp({ shape }) as ReactElement<Record<string, unknown>>;
		expect((el.props.style as Record<string, unknown>).backgroundColor).toBe("#cccccc");
	});

	it("falls back when the card-type is unknown", () => {
		const Comp = createCardSimplified(registry(makeCardType("media", true)));
		const el = Comp({ shape: cardShape("nope") }) as ReactElement<Record<string, unknown>>;
		expect((el.props.style as Record<string, unknown>).backgroundColor).toBe("#abcdef");
	});
});

describe("createDeckSimplified", () => {
	function deckShape(cardType: string, cards: Record<string, unknown>[]): ShapeData {
		return {
			id: "d1",
			type: DECK_TYPE,
			x: 5,
			y: 6,
			width: 100,
			height: 150,
			style: { fill: "#abcdef", stroke: "#000", strokeWidth: 1, opacity: 1 },
			meta: { cardType, cards, faceDown: true },
		} as ShapeData;
	}

	it("renders the top card's simplified content", () => {
		const Comp = createDeckSimplified(registry(makeCardType("media", true)));
		const el = Comp({
			shape: deckShape("media", [{ label: "TOP" }, { label: "next" }]),
		}) as ReactElement<Record<string, unknown>>;
		const inner = el.props.children as ReactElement<Record<string, unknown>>;
		expect(inner.props.children).toBe("TOP");
	});

	it("falls back to a fill rect for an empty deck", () => {
		const Comp = createDeckSimplified(registry(makeCardType("media", true)));
		const el = Comp({ shape: deckShape("media", []) }) as ReactElement<Record<string, unknown>>;
		expect((el.props.style as Record<string, unknown>).backgroundColor).toBe("#abcdef");
		expect(el.props.children).toBeUndefined();
	});
});
