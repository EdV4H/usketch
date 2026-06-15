import { DEFAULT_STYLE, generateId, type ShapeData } from "@edv4h/usketch-shared";
import type { CardShape, CardTypeDefinition, DeckShape } from "./types.js";

/** shape type 定数（レンダラ / ツールのディスパッチキー）。 */
export const CARD_TYPE = "card";
export const DECK_TYPE = "card-deck";

/**
 * カード shape データを生成する純ファクトリ。store には触れないので、
 * `store.addShape(createCardShape(def, {...}))` のように addShape の薄いラッパとして使う
 * （Undo したいなら createAddShapeCommand に渡す）。
 */
export function createCardShape(
	def: CardTypeDefinition,
	params: {
		x: number;
		y: number;
		id?: string;
		width?: number;
		height?: number;
		/** 省略時は def.createDefaultFields()。 */
		fields?: Record<string, unknown>;
		isFlipped?: boolean;
		zIndex?: string;
	},
): CardShape {
	return {
		id: params.id ?? generateId(),
		type: CARD_TYPE,
		x: params.x,
		y: params.y,
		width: params.width ?? def.defaultSize.width,
		height: params.height ?? def.defaultSize.height,
		style: { ...DEFAULT_STYLE },
		...(params.zIndex ? { zIndex: params.zIndex } : {}),
		meta: {
			cardType: def.id,
			isFlipped: params.isFlipped ?? false,
			fields: params.fields ?? def.createDefaultFields(),
		},
	};
}

/**
 * デッキ（山札）shape データを生成する純ファクトリ。
 * `cards` を渡せば**任意の山**（TCG の構築済みデッキ等）を作れる。省略時は def.buildDeck()。
 * 生成だけを担い、配置は `store.addShape(createDeckShape(def, {...}))` で行う。
 */
export function createDeckShape(
	def: CardTypeDefinition,
	params: {
		x: number;
		y: number;
		id?: string;
		width?: number;
		height?: number;
		/** 省略時は def.buildDeck?.() ?? []。index 0 が一番上。 */
		cards?: Record<string, unknown>[];
		faceDown?: boolean;
	},
): DeckShape {
	return {
		id: params.id ?? generateId(),
		type: DECK_TYPE,
		x: params.x,
		y: params.y,
		width: params.width ?? def.defaultSize.width,
		height: params.height ?? def.defaultSize.height,
		style: { ...DEFAULT_STYLE },
		meta: {
			cardType: def.id,
			cards: params.cards ?? def.buildDeck?.() ?? [],
			faceDown: params.faceDown ?? true,
		},
	};
}

/** 未知 / card-type 不在時の最小カード（描画は unknown フォールバックに任せる）。 */
export function createBareCardShape(params: { x: number; y: number; id?: string }): ShapeData {
	return {
		id: params.id ?? generateId(),
		type: CARD_TYPE,
		x: params.x,
		y: params.y,
		width: 200,
		height: 280,
		style: { ...DEFAULT_STYLE },
		meta: { cardType: "", isFlipped: false, fields: {} },
	};
}
