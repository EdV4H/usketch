import type { ShapeData } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";

/**
 * 配置（placement）アニメーション設定。カードが新規配置 / 移動された後に再生する。
 * プリセット名を指定するか、独自の CSS keyframes 名と再生時間を指定する。
 */
export type PlacementAnimation =
	| { preset: PlacementPreset }
	| { keyframes: string; durationMs: number; easing?: string };

export type PlacementPreset =
	| "deal"
	| "drop"
	| "bounce"
	| "none"
	// 「ドン！」と重みのある着地（衝撃リング + 接地シャドウ + 放射状の飛沫）。
	// 重いほど大きく・ゆっくり（light < medium < heavy）。
	| "slam-light"
	| "slam-medium"
	| "slam-heavy";

/**
 * 面（表 / 裏）のテクスチャ（背景）。画像 URL と収め方、背景色（CSS グラデーション可）を指定できる。
 * `image` が無ければ `color` のみが背景になる。
 */
export type CardTexture = {
	/** 背景画像 URL（data URL も可）。 */
	image?: string;
	/** 画像の収め方。`tile` は繰り返し。既定 `cover`。 */
	fit?: "cover" | "contain" | "fill" | "tile";
	/** 背景色 / グラデーション（画像が無い部分・透過部分に出る）。 */
	color?: string;
};

/**
 * 面上に配置する1つのテキスト要素。位置は割合（0..1, カードに対する相対）または px で指定でき、
 * アンカー（基準点）・回転・フォントなどを細かく指定できる。
 */
export type CardText = {
	text: string;
	/** 基準位置 x。`unit` が ratio なら 0..1、px なら px。 */
	x: number;
	/** 基準位置 y。 */
	y: number;
	/** 位置の単位。既定 `ratio`（リサイズ追従）。 */
	unit?: "ratio" | "px";
	/** x,y がテキストのどこを指すか（水平）。既定 `center`。 */
	align?: "left" | "center" | "right";
	/** x,y がテキストのどこを指すか（垂直）。既定 `middle`。 */
	vAlign?: "top" | "middle" | "bottom";
	/** 回転（度）。アンカー位置を中心に回す。 */
	rotation?: number;
	fontSize?: number;
	fontFamily?: string;
	fontWeight?: number | string;
	italic?: boolean;
	color?: string;
	letterSpacing?: number;
	lineHeight?: number;
	/** 折り返し幅（px）。指定すると複数行に折り返す。未指定は折り返さない（pre）。 */
	maxWidth?: number;
};

/** 1つの面（表 or 裏）の定義: テクスチャ + テキスト配置。 */
export type CardFace = {
	texture?: CardTexture;
	texts?: CardText[];
};

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
	/**
	 * この card-type のカード / デッキをリサイズ可能にするか。既定 `true`。
	 * `false` にすると、その card-type のカード・デッキはハンドル非表示・リサイズ操作無効
	 * （サイズ固定）になる。`createCardPlugin({ resizable })` のプラグイン全体既定より優先される。
	 */
	resizable?: boolean;
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
