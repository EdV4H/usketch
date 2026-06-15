import { customCardType } from "./card-types/custom.js";
import { mediaCardType } from "./card-types/media.js";
import { playingCardType } from "./card-types/playing-card.js";
import { unoCardType } from "./card-types/uno.js";
import type { CardTypeDefinition } from "./types.js";

/** 組込 card-type。拡張の手本でもある。 */
export const BUILTIN_CARD_TYPES: CardTypeDefinition[] = [
	mediaCardType,
	playingCardType,
	unoCardType,
	customCardType,
];

/**
 * 組込 + 追加 card-type をマージした `Map<id, def>` を返す。
 * id が衝突した場合は追加（extra）側で上書きする。
 */
export function createCardTypeRegistry(
	extra: CardTypeDefinition[] = [],
): Map<string, CardTypeDefinition> {
	const map = new Map<string, CardTypeDefinition>();
	for (const def of BUILTIN_CARD_TYPES) {
		map.set(def.id, def);
	}
	for (const def of extra) {
		map.set(def.id, def);
	}
	return map;
}
