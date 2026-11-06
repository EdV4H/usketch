import { getPenDefinition } from "./custom-pens.js";
import type { PenId, PenKind } from "./types.js";

/** 合成モード（CSS mix-blend-mode に対応）。 */
export type BlendMode = "normal" | "multiply";

export interface PenMeta {
	label: string;
	/** 既定太さ（設計書 §3）。 */
	defaultSize: number;
	/** 線幅が可変か（筆ペンのみ true）。 */
	variable: boolean;
	/** 不透明度。 */
	alpha: number;
	/** 合成モード。 */
	blend: BlendMode;
}

/** 設計書 §3 のペン表。 */
export const PEN_META: Record<PenKind, PenMeta> = {
	ballpoint: { label: "ボールペン", defaultSize: 2.5, variable: false, alpha: 1, blend: "normal" },
	felt: { label: "サインペン", defaultSize: 6, variable: false, alpha: 1, blend: "normal" },
	brush: { label: "筆ペン", defaultSize: 11, variable: true, alpha: 1, blend: "normal" },
	highlighter: {
		label: "蛍光ペン",
		defaultSize: 22,
		variable: false,
		alpha: 0.4,
		blend: "multiply",
	},
};

export const PEN_KINDS: PenKind[] = ["ballpoint", "felt", "brush", "highlighter"];

/** 省略時のペン（後方互換）。 */
export const DEFAULT_PEN: PenKind = "ballpoint";

/** プリセット8色（Wevox グラフパレット由来、設計書 §6）。既定は先頭。 */
export const PRESET_COLORS = [
	"#191C1C",
	"#DA3F00",
	"#FF8C00",
	"#E49D00",
	"#00A573",
	"#008484",
	"#0050E4",
	"#A42C80",
];

/** ペンの太さの既定値。 */
export const DEFAULT_SIZES: Record<PenKind, number> = {
	ballpoint: PEN_META.ballpoint.defaultSize,
	felt: PEN_META.felt.defaultSize,
	brush: PEN_META.brush.defaultSize,
	highlighter: PEN_META.highlighter.defaultSize,
};

/** 組み込みのペンか。 */
export function isBuiltInPen(pen: PenId | undefined): pen is PenKind {
	return pen !== undefined && Object.hasOwn(PEN_META, pen);
}

/**
 * `pen` から PenMeta を取得。外から足したペンは一定幅・不透明・通常合成として扱う。
 * 不明値（登録していないペンを含む）は ballpoint にフォールバック。
 */
export function penMeta(pen: PenId | undefined): PenMeta {
	if (isBuiltInPen(pen)) return PEN_META[pen];
	const custom = getPenDefinition(pen);
	if (custom) {
		return {
			label: custom.label,
			defaultSize: custom.defaultSize,
			variable: false,
			alpha: 1,
			blend: "normal",
		};
	}
	return PEN_META[DEFAULT_PEN];
}

/** 組み込み + 登録済みのペンか（`freedraw:set-pen` で選べるか）。 */
export function isKnownPen(pen: PenId | undefined): boolean {
	return isBuiltInPen(pen) || getPenDefinition(pen) !== undefined;
}
