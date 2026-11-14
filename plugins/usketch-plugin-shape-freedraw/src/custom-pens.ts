import type { BoardStore, CommandRegistry } from "@edv4h/usketch-shared";
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
	/**
	 * ペン固有の保存データ。shape の `penData` に入る。移動・拡大縮小では点列だけが
	 * 変わり、`penData` はそのまま写されるので、座標（点列から作った形など）は入れない。
	 */
	penData?: Record<string, unknown>;
	/** `false` なら端をつながない（周回コースのように端が無い線）。既定 `true`。 */
	snapEnds?: boolean;
}

/**
 * 外から足すペンの定義（`createFreedrawPlugin(config, { pens })` で渡す）。
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
	/**
	 * 端をつなぐ距離（world px、`endpointSnap` が有効なとき）。省略時は
	 * 画面上の数 px + `halfWidth(size)`。
	 */
	snapDistance?(size: number): number;
	/**
	 * 描いた人のクライアントで、確定した線が store に入った直後に 1 回だけ呼ぶ（同期先では
	 * 呼ばない）。`ctx.commands` で実行した変更は線の追加と同じ 1 回の undo / redo に入る
	 * （例: 引いた道の下の地形をならす）。投げた例外は握りつぶし、線はそのまま残す。
	 */
	onCommit?(shape: FreedrawShapeData, ctx: PenCommitContext): void;
}

/** {@link FreedrawPenDefinition.onCommit} に渡す文脈。 */
export interface PenCommitContext {
	store: BoardStore;
	/** ここで実行したコマンドは、線の追加と 1 つの undo 単位にまとまる。 */
	commands: CommandRegistry;
}

// 登録は JS ランタイム単位（同じランタイムの AppInstance で共有）。shape の当たり判定や
// 外接矩形は shape だけを受け取る純関数から呼ばれるため、ここから引けるようにしている。
const registry = new Map<string, { def: FreedrawPenDefinition; count: number }>();
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

/** 組み込みのペンの id なら例外にする（登録より前に全部確かめるため分けている）。 */
export function assertCustomPenId(id: string): void {
	if (BUILT_IN_IDS.has(id)) throw new Error(`freedraw: "${id}" is a built-in pen id`);
}

/**
 * ペンを登録する（freedraw プラグインの setup から呼ぶ）。同じ定義は登録した数だけ
 * 数え、全部外れたら消す（同じランタイムの複数ボードで共有しても、1 つの teardown で
 * 他のボードから消えない）。同じ id の別の定義は置き換える。戻り値で 1 回ぶん外す。
 */
export function registerPen(def: FreedrawPenDefinition): () => void {
	assertCustomPenId(def.id);
	const cur = registry.get(def.id);
	if (cur && cur.def === def) cur.count += 1;
	else {
		registry.set(def.id, { def, count: 1 });
		notify();
	}
	let released = false;
	return () => {
		if (released) return;
		released = true;
		const entry = registry.get(def.id);
		if (!entry || entry.def !== def) return;
		entry.count -= 1;
		if (entry.count > 0) return;
		registry.delete(def.id);
		notify();
	};
}

/** 登録済みのペン定義（組み込みのペンは含まない）。 */
export function getPenDefinition(id: string | undefined): FreedrawPenDefinition | undefined {
	return id === undefined ? undefined : registry.get(id)?.def;
}

/** 登録済みのペン定義の一覧（登録順）。 */
export function listPenDefinitions(): FreedrawPenDefinition[] {
	return [...registry.values()].map((e) => e.def);
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
