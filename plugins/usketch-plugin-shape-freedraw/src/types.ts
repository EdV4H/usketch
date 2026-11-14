import type { ShapeData } from "@edv4h/usketch-shared";

/** 4種のペン。差は「線幅が一定か可変か」「不透明度と合成モード」の2軸（設計書 §3）。 */
export type PenKind = "ballpoint" | "felt" | "brush" | "highlighter";

/**
 * shape / 設定に入るペンの id。組み込みの {@link PenKind} か、外から足したペン
 * （`FreedrawPenDefinition.id`）。
 */
export type PenId = PenKind | (string & {});

/**
 * ストロークの点。`p` は疑似筆圧 0..1（筆ペンのみ意味を持つ）。
 * 座標は world（既存の freedraw 同様、絶対座標）。`p` 省略時は一定幅扱いで、
 * 旧データ（`{x,y}` のみ）と後方互換。
 */
export interface StrokePoint {
	x: number;
	y: number;
	p?: number;
}

/**
 * Freedraw shape の intrinsic データ。
 * 色 = `style.stroke` / 太さ = `style.strokeWidth` / 不透明度 = `style.opacity`。
 * `pen` から合成モード・可変幅可否を導出する（`pen-meta.ts`）。`pen` 省略時は `ballpoint`。
 */
export interface FreedrawShapeData extends ShapeData {
	points: StrokePoint[];
	pen?: PenId;
	/** 外から足したペンの保存データ（`FreedrawPenDefinition.finalize` が返したもの）。 */
	penData?: Record<string, unknown>;
	/** 描いている最中の仮のストロークだけ `true`（確定で消える）。 */
	draft?: boolean;
	/**
	 * 端を近くの線へつないだか（`endpointSnap`）。`start` は points の先頭、`end` は末尾。
	 * 座標は持たないので、移動・拡大縮小でもそのまま写る。
	 */
	joins?: StrokeJoins;
}

/** {@link FreedrawShapeData.joins}。 */
export interface StrokeJoins {
	start?: true;
	end?: true;
}

/**
 * Emitted on the app's event bus when the user finishes a stroke and it has been added
 * (one undo step), only on the client that drew it. Payload: {@link FreedrawStrokeCommittedEvent}.
 */
export const FREEDRAW_STROKE_COMMITTED = "freedraw:stroke-committed";

/** Payload of {@link FREEDRAW_STROKE_COMMITTED}: the shape as added. */
export interface FreedrawStrokeCommittedEvent {
	shape: FreedrawShapeData;
}
