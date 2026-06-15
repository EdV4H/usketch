import type { ShapeData } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";

/**
 * 配置（placement）アニメーション設定。カードが新規配置 / 移動された後に再生する。
 * プリセット名を指定するか、独自の CSS keyframes 名と再生時間を指定する。
 */
export type PlacementAnimation =
	| { preset: PlacementPreset }
	| { keyframes: string; durationMs: number; easing?: string };

export type PlacementPreset = "deal" | "drop" | "bounce" | "none";

/**
 * card-type の拡張ポイント。トランプ / UNO / メディアカード等を表現するための定義。
 * `TFields` はその card-type 固有のデータ形（render 側で narrow する）。
 *
 * 新しい card-type を追加するには、この interface を満たすオブジェクトを作って
 * `createCardPlugin({ cardTypes: [myCardType] })` に渡す。
 */
export interface CardTypeDefinition<TFields = Record<string, unknown>> {
	/** 一意な id。`media` / `playing-card` / `uno` 等。CardMeta.cardType に格納される。 */
	id: string;
	/** ツールバー / ピッカー用の表示名。 */
	label: string;
	/** リサイズ時に固定するアスペクト比 (width / height)。 */
	aspectRatio: number;
	/** 新規カードの既定サイズ。 */
	defaultSize: { width: number; height: number };
	/** この card-type 固有の配置アニメ。省略時はプラグイン既定を使用。 */
	placementAnimation?: PlacementAnimation;
	// 関数は method 構文（bivariant）にして、具象 TFields の定義を
	// CardTypeDefinition<Record<string, unknown>> として束ねられるようにする。
	/** ツールバー / ピッカー用アイコン。 */
	icon(): ReactElement;
	/** 新規カードの初期 fields を生成する。 */
	createDefaultFields(): TFields;
	/** 表面の描画。 */
	renderFront(fields: TFields): ReactElement;
	/** 裏面の描画（共通カードバックでも可）。 */
	renderBack(fields: TFields): ReactElement;
	/** デッキ（山札）の初期内容を生成する。例: トランプ52枚 / UNO108枚。 */
	buildDeck?(): TFields[];
}

/** `card` shape の meta（generic 方式: ShapeData<CardMeta>）。 */
export type CardMeta = {
	/** 参照する CardTypeDefinition.id。 */
	cardType: string;
	/** 表 / 裏の view 状態。 */
	isFlipped: boolean;
	/** card-type 固有データ。型は各 card-type 側で narrow する。 */
	fields: Record<string, unknown>;
};

export type CardShape = ShapeData<CardMeta>;

/**
 * `card-deck` shape の meta。card データの配列を保持する「データパイル」方式
 * （52枚を52 shape にせず配列で持つ＝軽量 & シャッフル容易）。
 */
export type DeckMeta = {
	/** デッキが配る card-type の id。 */
	cardType: string;
	/** 山札の中身。index 0 = 一番上（次に配られる）。 */
	cards: Record<string, unknown>[];
	/** 伏せ置きかどうか（描画で裏面を見せる）。 */
	faceDown: boolean;
};

export type DeckShape = ShapeData<DeckMeta>;

/**
 * generic 共変性の制約で render 側は unknown 経由のキャストが要る。その escape を
 * helper 1 箇所に閉じ込め、利用側は型付きアクセスだけで済むようにする
 * （`plugins/usketch-plugin-domain-design/src/types.ts` の readMeta と同じ方針）。
 */
export function readCardMeta(shape: ShapeData): Partial<CardMeta> {
	return (shape.meta ?? {}) as unknown as Partial<CardMeta>;
}

export function readDeckMeta(shape: ShapeData): Partial<DeckMeta> {
	return (shape.meta ?? {}) as unknown as Partial<DeckMeta>;
}
