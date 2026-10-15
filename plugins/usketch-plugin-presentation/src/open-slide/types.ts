import type { ShapeData } from "@edv4h/usketch-shared";
import type { ComponentType } from "react";

/** open-slide の 1 ページを描く固定キャンバスの幅 (px)。`@open-slide/core` の CANVAS_WIDTH と同じ。 */
export const OPEN_SLIDE_CANVAS_WIDTH = 1920;
/** open-slide の 1 ページを描く固定キャンバスの高さ (px)。`@open-slide/core` の CANVAS_HEIGHT と同じ。 */
export const OPEN_SLIDE_CANVAS_HEIGHT = 1080;
/** open-slide のページの縦横比 (16:9)。 */
export const OPEN_SLIDE_ASPECT = OPEN_SLIDE_CANVAS_WIDTH / OPEN_SLIDE_CANVAS_HEIGHT;

/** open-slide デッキ Shape の type。 */
export const OPEN_SLIDE_SHAPE_TYPE = "open-slide";

/**
 * open-slide の DesignSystem と同じ形。`@open-slide/core` には依存せず構造的に受ける
 * （デッキの `export const design` をそのまま渡せる）。
 */
export interface OpenSlideDesign {
	palette: { bg: string; text: string; accent: string };
	fonts: { display: string; body: string };
	typeScale: { hero: number; body: number };
	radius: number;
}

/**
 * open-slide のデッキモジュール (`slides/<id>/index.tsx`) と同じ形。`@open-slide/core` の
 * `SlideModule` を構造的に受けるため、`import("./slides/x/index.tsx")` の結果をそのまま渡せる。
 */
export interface OpenSlideModule {
	/** ページ (1920×1080 に描かれる React コンポーネント) の並び。 */
	default: ComponentType[];
	meta?: { title?: string };
	design?: OpenSlideDesign;
	/** `default` と index を揃えた発表者ノート。 */
	notes?: (string | undefined)[];
}

/** ホストが登録するデッキ。モジュールは表示時に遅延 import する。 */
export interface OpenSlideDeck {
	/** デッキの一意 id。Shape はこの id でデッキを参照する。 */
	id: string;
	/** 挿入 UI やプレースホルダに出す名前。 */
	title: string;
	/** デッキモジュールを読み込む。`() => import("./slides/x/index.tsx")` を想定。 */
	load: () => Promise<OpenSlideModule>;
}

/** open-slide デッキ Shape のデータ。 */
export interface OpenSlideShapeData extends ShapeData {
	type: typeof OPEN_SLIDE_SHAPE_TYPE;
	/** 参照するデッキの id ({@link OpenSlideDeck.id})。 */
	deckId: string;
	/** 挿入時点のデッキ名。スライド一覧の表示や、デッキが未登録のときの表示に使う。 */
	title: string;
	/** 編集時に表示するページ (0 始まり)。発表中の送りではこの値は書き換えない。 */
	page: number;
	/**
	 * 挿入時点のページ数。デッキがまだ読み込まれていないときの発表ステップ数に使う。
	 * 読み込み後はデッキ側の実ページ数を優先する。
	 */
	pageCount: number;
	/** ボード上で書き換えた中身。書き換えていない箇所はデッキ側の値を使う。 */
	overrides?: OpenSlideOverrides;
}

/** デッキ Shape ごとの差し替え。デッキの作者が印を付けた箇所だけが対象。 */
export interface OpenSlideOverrides {
	/** `OpenSlideText` の文字。キーは `${ページ番号}:${id}` ({@link openSlideTextKey})。 */
	text?: Record<string, string>;
	/** 配色。指定した色だけデッキの `design.palette` を上書きする。 */
	palette?: Partial<OpenSlideDesign["palette"]>;
}

/** {@link OpenSlideOverrides.text} のキー。 */
export function openSlideTextKey(page: number, id: string): string {
	return `${page}:${id}`;
}

export function isOpenSlideShape(shape: ShapeData): shape is OpenSlideShapeData {
	return shape.type === OPEN_SLIDE_SHAPE_TYPE;
}
