import type { ShapeData } from "@edv4h/usketch-shared";

/** 4種のペン。差は「線幅が一定か可変か」「不透明度と合成モード」の2軸（設計書 §3）。 */
export type PenKind = "ballpoint" | "felt" | "brush" | "highlighter";

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
	pen?: PenKind;
}
