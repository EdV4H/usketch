import { z } from "zod";
import { DEFAULT_PEN, DEFAULT_SIZES, PRESET_COLORS } from "./pen-meta.js";

/** 太さ・消しゴム・筆圧感度の範囲（設計書 §7,§11,§12）。 */
export const SIZE_RANGE = { min: 1, max: 48, step: 0.5 } as const;
export const ERASER_RANGE = { min: 10, max: 100, step: 1 } as const;
export const BRUSH_DYNAMICS_RANGE = { min: 10, max: 100, step: 5 } as const;

/** 設計書の主要定数（§12）。 */
export const TUNING = {
	/** 点の間引き距離（screen px）。これ未満の move は破棄。 */
	minSampleDist: 0.8,
	/** 太さ平滑化係数（前フレームへ向けた lerp）。 */
	widthSmoothing: 0.4,
	/** 始点の初期筆圧（書き始めの入り）。 */
	startPressure: 0.45,
	/** 確定時の RDP 間引き許容誤差（world px、0 で無効）。 */
	simplifyTolerance: 0.6,
} as const;

const SizesSchema = z.object({
	ballpoint: z.number().positive(),
	felt: z.number().positive(),
	brush: z.number().positive(),
	highlighter: z.number().positive(),
});

/** プラグイン設定（JSON 可、Zod 検証）。実行時の可変状態は settings-store が持つ。 */
export const FreedrawConfigSchema = z.object({
	/** 既定ペン。 */
	defaultPen: z.enum(["ballpoint", "felt", "brush", "highlighter"]).default(DEFAULT_PEN),
	/** 既定色。 */
	defaultColor: z.string().default(PRESET_COLORS[0]),
	/** ペンごとの既定太さ。 */
	defaultSizes: SizesSchema.default(DEFAULT_SIZES),
	/** 消しゴムの既定サイズ。 */
	defaultEraserSize: z.number().min(ERASER_RANGE.min).max(ERASER_RANGE.max).default(30),
	/** 筆圧の効き（10〜100、既定60）。 */
	brushDynamics: z.number().min(BRUSH_DYNAMICS_RANGE.min).max(BRUSH_DYNAMICS_RANGE.max).default(60),
	/** ペン先カーソル表示。 */
	cursorPreview: z.boolean().default(true),
	/** 設定の localStorage 永続化を行うか。 */
	persistSettings: z.boolean().default(true),
});

export type FreedrawConfig = z.infer<typeof FreedrawConfigSchema>;
export type FreedrawConfigInput = z.input<typeof FreedrawConfigSchema>;

export function parseFreedrawConfig(input?: FreedrawConfigInput): FreedrawConfig {
	return FreedrawConfigSchema.parse(input ?? {});
}

/** localStorage キー。 */
export const STORAGE_KEY = "usketch-plugin-freedraw-v1";
