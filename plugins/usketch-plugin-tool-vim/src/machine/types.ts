import type { Point, ShapeData, ToolContext } from "@edv4h/usketch-shared";
import type { ShapeSpec, VimConfig } from "../config/schema.js";
import type { VimExtensions } from "../extensions.js";

/** Vim の主要モード（machine の state 値と対応）。 */
export type VimMode = "normal" | "insert" | "visual" | "command" | "hop";

/** hop（ラベルジャンプ）の1ターゲット。 */
export interface HopTarget {
	id: string;
	label: string;
	/** shape 中心の world 座標。 */
	cx: number;
	cy: number;
}

/** hjkl の方向。 */
export type Direction = "left" | "down" | "up" | "right";

/** operator-pending で保持する演算子。 */
export type VimOperator = "delete" | "yank";

/** insert モードの shape 候補（入力バッファにマッチしたもの）。 */
export interface ShapeCandidate {
	/** マッチした別名 or 型名。 */
	alias: string;
	/** 生成に使う shape 指定。 */
	spec: ShapeSpec;
	/** 表示ラベル。 */
	label: string;
}

/**
 * machine が store などを操作するための依存。`ToolContext`（store/shapes/commands/events）
 * をそのまま使う。シリアライズ不要なので context に保持する。
 */
export type VimDeps = ToolContext;

export interface VimContext {
	/** 論理カーソル（world 座標）。 */
	cursor: Point;
	/** 数値プレフィックス（`5j` の 5）。未入力なら null。 */
	count: number | null;
	/** operator-pending 中の演算子。 */
	pendingOperator: VimOperator | null;
	/** insert モードの入力バッファ。 */
	inputBuffer: string;
	/** command モードの入力バッファ（先頭の `:` は含めない）。 */
	commandBuffer: string;
	/** insert 候補一覧。 */
	candidates: ShapeCandidate[];
	/** 選択中の候補インデックス。 */
	candidateIndex: number;
	/** yank レジスタ（コピーした shape のスナップショット）。 */
	register: ShapeData[];
	/** マーク（`ma` で保存した world 座標）。 */
	marks: Record<string, Point>;
	/** which-key オーバーレイの表示状態。 */
	whichKeyVisible: boolean;
	/** `:help` 全画面ヘルプの表示状態。 */
	helpVisible: boolean;
	/** hop モードのラベル一覧（hop 中のみ非空）。 */
	hopLabels: HopTarget[];
	/** hop モードで入力済みのラベル文字。 */
	hopBuffer: string;
	/** 直近に実行した ex コマンドの結果メッセージ（ステータスライン表示用）。 */
	lastMessage: string | null;
	/** 設定。 */
	config: VimConfig;
	/** 実行時依存。 */
	deps: VimDeps;
	/** 開発者拡張（独自コマンド / キーバインド）。 */
	extensions: VimExtensions;
}

export type VimEvent =
	| { type: "MOTION"; dir: Direction; shift: boolean }
	| { type: "DIGIT"; n: number }
	| { type: "MODE_INSERT" }
	| { type: "MODE_VISUAL"; multi: boolean }
	| { type: "MODE_COMMAND" }
	| { type: "ESCAPE" }
	| { type: "COMMIT" }
	| { type: "TEXT"; char: string }
	| { type: "BACKSPACE" }
	| { type: "TAB"; shift: boolean }
	| { type: "OPERATOR"; op: VimOperator }
	| { type: "PASTE" }
	| { type: "UNDO" }
	| { type: "REDO" }
	| { type: "ZOOM"; dir: "in" | "out" }
	/** ビューポートをカーソル位置へ寄せる（zz）。 */
	| { type: "CENTER" }
	/** カーソルを画面中央（現在の可視領域の中心）へ移動する（M）。 */
	| { type: "CURSOR_CENTER" }
	| { type: "JUMP"; to: "first" | "last" }
	| { type: "COMMAND_CHAR"; char: string }
	| { type: "COMMAND_BACKSPACE" }
	| { type: "RUN_COMMAND" }
	| { type: "TOGGLE_WHICH_KEY" }
	| { type: "SET_MARK"; key: string }
	| { type: "JUMP_MARK"; key: string }
	/** hop（ラベルジャンプ）開始。 */
	| { type: "HOP_START" }
	/** hop 中のラベル文字入力。 */
	| { type: "HOP_KEY"; char: string }
	/** 開発者が登録した独自キーバインドの実行（mode+key で extensions を引く）。 */
	| { type: "CUSTOM_BINDING"; mode: VimMode; key: string }
	/** ツール起動時にカーソルを初期化し normal へ戻す（register/marks は保持）。 */
	| { type: "RESET"; cursor: Point };

/** machine の input（createActor 時に渡す）。 */
export interface VimInput {
	config: VimConfig;
	deps: VimDeps;
	extensions: VimExtensions;
	/** 初期カーソル位置（world 座標）。 */
	initialCursor: Point;
}
