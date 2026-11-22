import type { ShapeData } from "@edv4h/usketch-shared";
import { CARD_TYPE, DECK_TYPE } from "./factory.js";
import { readCardMeta, readDeckMeta } from "./types.js";

/**
 * Turn a card or a deck up or down. Returns the patch to apply, or `null` when
 * `shape` is neither or already shows that face. Fits the `turnFace` option
 * of `createTabletopPlugin` (`@edv4h/usketch-plugin-tabletop`), so a zone set
 * to "face down" turns the cards dropped in it.
 *
 * A card is face up while `isFlipped` is false; a deck while `faceDown` is false.
 */
export function cardTurnFace(shape: ShapeData, face: "up" | "down"): Partial<ShapeData> | null {
	const down = face === "down";
	if (shape.type === CARD_TYPE) {
		const meta = readCardMeta(shape);
		if ((meta.isFlipped ?? false) === down) return null;
		return { meta: { ...(shape.meta ?? {}), isFlipped: down } as ShapeData["meta"] };
	}
	if (shape.type === DECK_TYPE) {
		const meta = readDeckMeta(shape);
		if ((meta.faceDown ?? true) === down) return null;
		return { meta: { ...(shape.meta ?? {}), faceDown: down } as ShapeData["meta"] };
	}
	return null;
}
