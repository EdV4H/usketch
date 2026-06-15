import { customCardType } from "./card-types/custom.js";
import { mediaCardType } from "./card-types/media.js";
import { playingCardType } from "./card-types/playing-card.js";
import { unoCardType } from "./card-types/uno.js";
import type { CardTypeDefinition } from "./types.js";

/**
 * 同梱のサンプル card-type。**既定では登録されない**（`createCardPlugin()` は空で動く）。
 * 使いたい場合は明示的に渡す: `createCardPlugin({ cardTypes: EXAMPLE_CARD_TYPES })`。
 * 独自 card-type を作る際の手本でもある。
 */
export const EXAMPLE_CARD_TYPES: CardTypeDefinition[] = [
	mediaCardType,
	playingCardType,
	unoCardType,
	customCardType,
];

/**
 * 渡された card-type 群から `Map<id, def>` を作る。組込は自動では含めない
 * （サンプルが必要なら呼び出し側で `EXAMPLE_CARD_TYPES` を渡す）。
 * id が衝突した場合は後勝ち。
 */
export function createCardTypeRegistry(
	cardTypes: CardTypeDefinition[] = [],
): Map<string, CardTypeDefinition> {
	const map = new Map<string, CardTypeDefinition>();
	for (const def of cardTypes) {
		map.set(def.id, def);
	}
	return map;
}
