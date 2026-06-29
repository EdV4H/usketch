import type {
	BoardStore,
	CommandRegistry,
	EventBus,
	Point,
	ShapeRegistry,
} from "@edv4h/usketch-shared";
import type { VimMode } from "./machine/types.js";

/**
 * 独自コマンド / キーバインドのハンドラに渡される操作 API。
 * store / shapes / commands / events は実サービスへの直接参照（即時反映）。
 * カーソル・モード・メッセージは machine 状態なので、専用メソッド経由で更新する
 * （ハンドラ内では `getCursor()` が `setCursor()` の結果を即座に反映する）。
 */
export interface VimApi {
	readonly store: BoardStore;
	readonly shapes: ShapeRegistry;
	readonly commands: CommandRegistry;
	readonly events: EventBus;
	/** 現在の論理カーソル（world 座標）。 */
	getCursor(): Point;
	/** 現在のモード。 */
	getMode(): VimMode;
	/** 現在の選択 shape ID。 */
	getSelection(): ReadonlySet<string>;
	/** 論理カーソルを移動する。 */
	setCursor(p: Point): void;
	/** モードを切り替える（normal/insert/visual/command/hop）。 */
	setMode(mode: VimMode): void;
	/** ステータスラインにメッセージを表示する。 */
	message(msg: string): void;
}

/**
 * `:name args...` で呼ばれる独自 ex コマンド。戻り値の文字列はステータスラインに出る。
 * メッセージ不要なら何も返さなくてよい（void）ため、union に void を含めるのは意図的。
 */
// biome-ignore lint/suspicious/noConfusingVoidType: メッセージ文字列 or 何も返さない（任意）を表すため
export type VimCommandHandler = (args: string[], api: VimApi) => string | void;

/** キーに割り当てる独自関数。 */
export type VimBindingHandler = (api: VimApi) => void;

/**
 * 開発者向け拡張。`createVimToolPlugin(config, extensions)` の第2引数。
 * 関数を含むため JSON 化できず、Zod 検証される `config` とは分離している。
 */
export interface VimExtensions {
	/** 独自 ex コマンド（コマンド名 → ハンドラ）。組み込みコマンドより優先される。 */
	commands?: Record<string, VimCommandHandler>;
	/** モードごとの キー → 独自関数。組み込みキーマップより優先される。 */
	bindings?: Partial<Record<VimMode, Record<string, VimBindingHandler>>>;
}
