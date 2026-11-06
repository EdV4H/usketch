import type { ReactElement } from "react";
import type { FreedrawShapeData, PenKind, StrokePoint } from "./types.js";

/** 太さの範囲（world px）。 */
export interface PenSizeRange {
	min: number;
	max: number;
}

/** {@link FreedrawPenDefinition.finalize} の戻り値。 */
export interface FinalizedStroke {
	/** 保存する点列（world 座標）。 */
	points: StrokePoint[];
	/** ペン固有の保存データ。shape の `penData` に入る。 */
	penData?: Record<string, unknown>;
}

/**
 * 外から足すペンの定義（`createFreedrawPlugin(config, { pens })` か
 * {@link FreedrawApi.registerPen} で登録する）。
 *
 * 足したペンのストロークも組み込みのペンと同じ `freedraw` shape になるので、選択・移動・
 * 拡大縮小・消しゴム・当たり判定・undo はそのまま効く。描画は SVG（DOM）で行い、GPU には
 * 回さない。ペンを登録していないクライアントでは、そのストロークはボールペンの線で描かれる。
 */
export interface FreedrawPenDefinition {
	/** shape の `pen` に入る id。組み込みのペン（ballpoint など）とは重ねない。 */
	id: string;
	label: string;
	/** 既定の太さ（world px）。 */
	defaultSize: number;
	/** 太さの範囲。`freedraw:set-size` はこの範囲に丸める。省略時は丸めない。 */
	sizeRange?: PenSizeRange;
	/** 色を使うか（`false` ならペン先カーソルを色なしで出す）。既定 `true`。 */
	usesColor?: boolean;
	/** 確定したストロークの描画。 */
	render(shape: FreedrawShapeData): ReactElement;
	/** 描いている最中（`shape.draft === true`）の描画。省略時は {@link render}。 */
	renderDraft?(shape: FreedrawShapeData): ReactElement;
	/**
	 * 手を離したときに 1 回だけ呼ぶ。間引き後の点列を受け取り、保存する点列と
	 * ペン固有のデータを返す。省略時は点列をそのまま保存する。
	 */
	finalize?(points: StrokePoint[], ctx: { size: number }): FinalizedStroke;
	/**
	 * 点列（中心線）から描画の端までの最大の距離。外接矩形・当たり判定・消しゴムに使う。
	 * 省略時は `size / 2`。
	 */
	halfWidth?(size: number): number;
}

// 登録は JS ランタイム単位（同じランタイムの AppInstance で共有）。shape の当たり判定や
// 外接矩形は shape だけを受け取る純関数から呼ばれるため、ここから引けるようにしている。
const registry = new Map<string, FreedrawPenDefinition>();
// 組み込みのペンの id（pen-meta.ts の PEN_KINDS と同じ。循環 import を避けて自前で持つ）。
const BUILT_IN_IDS: ReadonlySet<string> = new Set<PenKind>([
	"ballpoint",
	"felt",
	"brush",
	"highlighter",
]);
const listeners = new Set<() => void>();

const notify = () => {
	for (const l of listeners) l();
};

/**
 * ペンを登録する。同じ id があれば置き換える。戻り値で登録を外す（その後に同じ id で
 * 別の定義が登録されていれば、そちらは残す）。
 */
export function registerPen(def: FreedrawPenDefinition): () => void {
	if (BUILT_IN_IDS.has(def.id)) {
		throw new Error(`freedraw: "${def.id}" is a built-in pen id`);
	}
	registry.set(def.id, def);
	notify();
	return () => {
		if (registry.get(def.id) !== def) return;
		registry.delete(def.id);
		notify();
	};
}

/** 登録済みのペン定義（組み込みのペンは含まない）。 */
export function getPenDefinition(id: string | undefined): FreedrawPenDefinition | undefined {
	return id === undefined ? undefined : registry.get(id);
}

/** 登録済みのペン定義の一覧（登録順）。 */
export function listPenDefinitions(): FreedrawPenDefinition[] {
	return [...registry.values()];
}

/** 登録が変わったら呼ぶ。戻り値で解除。 */
export function onPensChange(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** `size` を定義の範囲に丸める（範囲が無ければそのまま）。 */
export function clampPenSize(def: FreedrawPenDefinition | undefined, size: number): number {
	const r = def?.sizeRange;
	if (!r) return size;
	return Math.min(r.max, Math.max(r.min, size));
}
