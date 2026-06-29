import { z } from "zod";
import { HOP_TRIGGER } from "../constants.js";

/**
 * Vim プラグインの設定スキーマ（Zod）。
 *
 * すべてのフィールドに既定値を持たせてあるので、`VimConfigSchema.parse({})` で
 * 完全な設定が得られる。ユーザーは `createVimToolPlugin(partial)` で一部だけ
 * 上書きできる（`mergeConfig` がディープマージする）。
 */

/** insert モードで文字列から生成する shape の指定。 */
export const ShapeSpecSchema = z.object({
	/** shape レジストリに登録された型名（例 "rectangle" / "text" / "sticky"）。 */
	type: z.string(),
	/** 既定の幅（省略時は shape の createDefault に委ねる）。 */
	width: z.number().positive().optional(),
	/** 既定の高さ（省略時は shape の createDefault に委ねる）。 */
	height: z.number().positive().optional(),
	/** スタイルの部分上書き。 */
	style: z
		.object({
			fill: z.string(),
			stroke: z.string(),
			strokeWidth: z.number(),
			opacity: z.number(),
		})
		.partial()
		.optional(),
	/** shape の meta 初期値（sticky の色など）。 */
	meta: z.record(z.string(), z.unknown()).optional(),
	/** 候補一覧に出すラベル（省略時は type）。 */
	label: z.string().optional(),
});

export type ShapeSpec = z.infer<typeof ShapeSpecSchema>;

/** モードごとのキー → アクショントークンの上書きマップ。 */
const KeymapSchema = z.record(z.string(), z.record(z.string(), z.string()));

export const VimConfigSchema = z.object({
	/** normal モードの hjkl で論理カーソルが動く距離（world px）。 */
	cursorStep: z.number().positive().default(20),
	/** Shift+hjkl で画角を動かす距離（screen px）。 */
	panStep: z.number().positive().default(80),
	/** +/- でのズーム倍率。 */
	zoomStep: z.number().min(1.01).default(1.2),
	/** カーソル移動をグリッドにスナップするか。 */
	snapToGrid: z.boolean().default(true),
	/** スナップ時のグリッド間隔（world px）。 */
	gridSize: z.number().positive().default(20),
	/** which-key オーバーレイを表示するか。 */
	showWhichKey: z.boolean().default(true),
	/** ステータスラインを表示するか。 */
	showStatusLine: z.boolean().default(true),
	/** Vim を抜けたとき（:q）に戻るツール ID。 */
	exitToolId: z.string().default("select"),
	/**
	 * hop（ラベルジャンプ）で使う文字。先頭から順に近い shape へ割り当てる。
	 * トリガー文字（`f`）はラベルから除外されるため、除外後に異なる文字が2つ以上必要。
	 */
	hopKeys: z
		.string()
		.refine(
			(s) => new Set(s.split("").filter((c) => c !== HOP_TRIGGER)).size >= 2,
			`hopKeys には "${HOP_TRIGGER}" 以外の異なる文字が2つ以上必要です`,
		)
		.default("fjdkslaghrueiwoncm"),
	/** insert: 文字列 → shape の明示マッピング。未定義の型はレジストリから自動補完。 */
	shapeMap: z.record(z.string(), ShapeSpecSchema).default({}),
	/** キーバインドのリマップ（既定キーマップへの部分上書き）。 */
	keymap: KeymapSchema.default({}),
});

export type VimConfig = z.infer<typeof VimConfigSchema>;
export type VimConfigInput = z.input<typeof VimConfigSchema>;
