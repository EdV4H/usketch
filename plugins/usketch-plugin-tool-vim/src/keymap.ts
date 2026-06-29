import type { VimConfig } from "./config/schema.js";
import { HOP_TRIGGER } from "./constants.js";
import type { VimExtensions } from "./extensions.js";
import type { Direction, VimEvent, VimMode } from "./machine/types.js";

/**
 * 生の KeyboardEvent を {@link VimEvent} に変換する純関数。
 *
 * 複数キーのプレフィックス（`gg` `zz` `ma` `` `a ``）は `pending` 文字で表現し、
 * 呼び出し側（plugin.tsx）が次回呼び出しに引き渡す。count（`5j`）と operator（`d`）は
 * machine 側で扱うため、ここでは DIGIT / OPERATOR イベントとして素直に送る。
 *
 * @returns event: 送るべきイベント（無ければ null）, pending: 次に持ち越すプレフィックス
 */
export function translateKey(
	e: KeyboardEvent,
	mode: VimMode,
	config: VimConfig,
	pending: string,
	bindings?: VimExtensions["bindings"],
): { event: VimEvent | null; pending: string } {
	const key = e.key;

	// ── 開発者の独自キーバインド（全モードで最優先） ──
	if (bindings?.[mode]?.[key]) {
		return { event: { type: "CUSTOM_BINDING", mode, key }, pending: "" };
	}

	// ── insert モード ──
	if (mode === "insert") {
		if (key === "Escape") return { event: { type: "ESCAPE" }, pending: "" };
		if (key === "Enter") return { event: { type: "COMMIT" }, pending: "" };
		if (key === "Tab") return { event: { type: "TAB", shift: e.shiftKey }, pending: "" };
		if (key === "Backspace") return { event: { type: "BACKSPACE" }, pending: "" };
		if (key.length === 1 && !e.ctrlKey && !e.metaKey) {
			return { event: { type: "TEXT", char: key }, pending: "" };
		}
		return { event: null, pending: "" };
	}

	// ── command モード ──
	if (mode === "command") {
		if (key === "Escape") return { event: { type: "ESCAPE" }, pending: "" };
		if (key === "Enter") return { event: { type: "RUN_COMMAND" }, pending: "" };
		if (key === "Backspace") return { event: { type: "COMMAND_BACKSPACE" }, pending: "" };
		if (key.length === 1 && !e.ctrlKey && !e.metaKey) {
			return { event: { type: "COMMAND_CHAR", char: key }, pending: "" };
		}
		return { event: null, pending: "" };
	}

	// ── hop モード（ラベル入力） ──
	if (mode === "hop") {
		if (key === "Escape") return { event: { type: "ESCAPE" }, pending: "" };
		if (key.length === 1 && !e.ctrlKey && !e.metaKey) {
			return { event: { type: "HOP_KEY", char: key }, pending: "" };
		}
		return { event: null, pending: "" };
	}

	// ── normal / visual: 修飾キー付きは Vim キーとして解釈しない ──
	// （Ctrl+F=検索 / Ctrl+T=新規タブ 等のブラウザ既定を尊重。redo の Ctrl/Meta+r のみ許可）
	if (e.ctrlKey || e.metaKey || e.altKey) {
		if ((e.ctrlKey || e.metaKey) && key === "r") {
			return { event: { type: "REDO" }, pending: "" };
		}
		return { event: null, pending: "" };
	}

	// ── normal / visual に共通する多キープレフィックスの解決 ──
	// プレフィックスが確定すればそのイベントを返す。未確定キー（不一致）の場合は
	// 早期 return せずプレフィックスを破棄して下の通常解釈へフォールスルーする
	// （例: "g" の直後に Esc → ESCAPE が落ち、visual を抜けられる）。
	if (pending === "g") {
		if (key === "g") return { event: { type: "JUMP", to: "first" }, pending: "" };
	} else if (pending === "z") {
		if (key === "z") return { event: { type: "CENTER" }, pending: "" };
	} else if (pending === "m") {
		if (/^[a-z]$/.test(key)) return { event: { type: "SET_MARK", key }, pending: "" };
	} else if (pending === "`" || pending === "'") {
		if (/^[a-z]$/.test(key)) return { event: { type: "JUMP_MARK", key }, pending: "" };
	}

	// ── config によるリマップ（mode 単位） ──
	const remap = config.keymap[mode]?.[key];
	if (remap) {
		return { event: tokenToEvent(remap), pending: "" };
	}

	// ── 既定キーマップ（normal / visual 共通の motion 等） ──
	// hop トリガー（ラベル文字とは別。config remap より後＝remap 優先）。
	if (key === HOP_TRIGGER) {
		return { event: { type: "HOP_START" }, pending: "" };
	}

	const motion = MOTION_KEYS[key];
	if (motion) {
		// 大文字 HJKL は pan、小文字 hjkl は cursor/selection 移動。
		const shift = key === key.toUpperCase() && key !== key.toLowerCase();
		return { event: { type: "MOTION", dir: motion, shift }, pending: "" };
	}

	if (/^[0-9]$/.test(key)) {
		return { event: { type: "DIGIT", n: Number(key) }, pending: "" };
	}

	switch (key) {
		case "Escape":
			return { event: { type: "ESCAPE" }, pending: "" };
		case "i":
			return { event: { type: "MODE_INSERT" }, pending: "" };
		case "v":
			return { event: { type: "MODE_VISUAL", multi: false }, pending: "" };
		case "V":
			return { event: { type: "MODE_VISUAL", multi: true }, pending: "" };
		case ":":
			return { event: { type: "MODE_COMMAND" }, pending: "" };
		case "x":
		case "d":
			return { event: { type: "OPERATOR", op: "delete" }, pending: "" };
		case "y":
			return { event: { type: "OPERATOR", op: "yank" }, pending: "" };
		case "p":
			return { event: { type: "PASTE" }, pending: "" };
		case "u":
			return { event: { type: "UNDO" }, pending: "" };
		case "r":
			if (e.ctrlKey || e.metaKey) return { event: { type: "REDO" }, pending: "" };
			return { event: null, pending: "" };
		case "+":
		case "=":
			return { event: { type: "ZOOM", dir: "in" }, pending: "" };
		case "-":
		case "_":
			return { event: { type: "ZOOM", dir: "out" }, pending: "" };
		case "G":
			return { event: { type: "JUMP", to: "last" }, pending: "" };
		case "M":
			return { event: { type: "CURSOR_CENTER" }, pending: "" };
		case "?":
			return { event: { type: "TOGGLE_WHICH_KEY" }, pending: "" };
		case "g":
			return { event: null, pending: "g" };
		case "z":
			return { event: null, pending: "z" };
		case "m":
			return { event: null, pending: "m" };
		case "`":
		case "'":
			return { event: null, pending: key };
		default:
			return { event: null, pending: "" };
	}
}

const MOTION_KEYS: Record<string, Direction> = {
	h: "left",
	j: "down",
	k: "up",
	l: "right",
	H: "left",
	J: "down",
	K: "up",
	L: "right",
};

/** config のアクショントークンを VimEvent に変換。 */
function tokenToEvent(token: string): VimEvent | null {
	const [head, tail] = token.split(":");
	switch (head) {
		case "motion":
			if (isDirection(tail)) return { type: "MOTION", dir: tail, shift: false };
			return null;
		case "pan":
			if (isDirection(tail)) return { type: "MOTION", dir: tail, shift: true };
			return null;
		case "mode":
			if (tail === "insert") return { type: "MODE_INSERT" };
			if (tail === "visual") return { type: "MODE_VISUAL", multi: false };
			if (tail === "visual-multi") return { type: "MODE_VISUAL", multi: true };
			if (tail === "command") return { type: "MODE_COMMAND" };
			if (tail === "normal") return { type: "ESCAPE" };
			return null;
		case "operator":
			if (tail === "delete") return { type: "OPERATOR", op: "delete" };
			if (tail === "yank") return { type: "OPERATOR", op: "yank" };
			return null;
		case "zoom":
			if (tail === "in" || tail === "out") return { type: "ZOOM", dir: tail };
			return null;
		case "jump":
			if (tail === "first" || tail === "last") return { type: "JUMP", to: tail };
			return null;
		case "escape":
			return { type: "ESCAPE" };
		case "commit":
			return { type: "COMMIT" };
		case "paste":
			return { type: "PASTE" };
		case "undo":
			return { type: "UNDO" };
		case "redo":
			return { type: "REDO" };
		case "center":
			return { type: "CENTER" };
		case "hop":
			return { type: "HOP_START" };
		case "toggle-which-key":
			return { type: "TOGGLE_WHICH_KEY" };
		default:
			return null;
	}
}

function isDirection(v: string | undefined): v is Direction {
	return v === "left" || v === "right" || v === "up" || v === "down";
}
