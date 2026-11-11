// Key configuration: the pure rules behind the HUD's "キー設定" panel — which actions
// can be bound, how a key is shown, which keys are refused, how a new binding moves a
// key off the action that had it, and how bindings are stored per viewer. No DOM and
// no store here (the panel and the plugin wire these up).
import type { CharacterKeys } from "./character-types.js";

export type KeyAction = "up" | "down" | "left" | "right" | "jump" | "drift";

/** The actions in panel order. */
export const KEY_ACTIONS: readonly KeyAction[] = ["up", "down", "left", "right", "jump", "drift"];

export const KEY_ACTION_LABELS: Readonly<Record<KeyAction, string>> = {
	up: "上 / 前進",
	down: "下 / 後退",
	left: "左",
	right: "右",
	jump: "ジャンプ",
	drift: "ドリフト（車）",
};

/** How many keys the panel lets one action have. */
export const MAX_KEYS_PER_ACTION = 2;

/** localStorage key holding this viewer's bindings. */
export const KEYS_STORAGE_KEY = "usketch-plugin-character:keys";

const DIRECTIONS: readonly KeyAction[] = ["up", "down", "left", "right"];

const NAMED: Readonly<Record<string, string>> = {
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
	Space: "Space",
	ShiftLeft: "左 Shift",
	ShiftRight: "右 Shift",
	Enter: "Enter",
	NumpadEnter: "テンキー Enter",
	Backquote: "`",
	Minus: "-",
	Equal: "=",
	BracketLeft: "[",
	BracketRight: "]",
	Backslash: "\\",
	Semicolon: ";",
	Quote: "'",
	Comma: ",",
	Period: ".",
	Slash: "/",
	IntlRo: "\\",
	IntlYen: "¥",
};

/** A `KeyboardEvent.code` as shown to people: `KeyW` → `W`, `ArrowUp` → `↑`. Pure. */
export function keyLabel(code: string): string {
	if (NAMED[code]) return NAMED[code];
	const letter = /^Key([A-Z])$/.exec(code);
	if (letter) return letter[1] as string;
	const digit = /^Digit(\d)$/.exec(code);
	if (digit) return digit[1] as string;
	const numpad = /^Numpad(.+)$/.exec(code);
	if (numpad) return `テンキー ${numpad[1]}`;
	return code;
}

/** Keys that are never bound: they leave the panel, move focus, or only modify others. */
const REFUSED = new Set([
	"Escape",
	"Tab",
	"ControlLeft",
	"ControlRight",
	"AltLeft",
	"AltRight",
	"MetaLeft",
	"MetaRight",
	"OSLeft",
	"OSRight",
	"CapsLock",
	"ContextMenu",
	"Fn",
	"FnLock",
]);

const SHIFT = new Set(["ShiftLeft", "ShiftRight"]);

/**
 * Whether `code` can be bound to `action`: never Esc, Tab or a lone Ctrl / Alt / Meta,
 * and Shift only for the jump and the drift (held with a direction it would turn the
 * direction's letter upper-case for the host's shortcuts). Pure.
 */
export function canBindKey(code: string, action: KeyAction): boolean {
	if (!code || REFUSED.has(code)) return false;
	if (SHIFT.has(code)) return action === "jump" || action === "drift";
	return true;
}

const listOf = (keys: CharacterKeys, action: KeyAction): string[] => [...(keys[action] ?? [])];

/**
 * `keys` with `code` bound to `action` at `slot` (replacing what was there; a slot past
 * the end appends). The key is taken off every other
 * action first, so one key never does two things. Unchanged when the key can't be bound
 * (see {@link canBindKey}). Pure.
 */
export function bindKey(
	keys: CharacterKeys,
	action: KeyAction,
	slot: number,
	code: string,
): CharacterKeys {
	if (!canBindKey(code, action)) return keys;
	const next: CharacterKeys = { ...keys };
	for (const a of KEY_ACTIONS) {
		if (a === action) continue;
		const list = keys[a];
		if (list?.includes(code)) next[a] = list.filter((c) => c !== code);
	}
	const own = listOf(keys, action);
	const at = own.indexOf(code);
	if (at >= 0 && at !== slot) own.splice(at, 1); // already there: move, don't duplicate
	const i = Math.max(0, Math.min(Math.floor(slot), own.length));
	if (i < own.length) own[i] = code;
	else own.push(code);
	next[action] = own;
	return next;
}

/** `keys` with the key at `slot` of `action` removed (unchanged when there is none). Pure. */
export function unbindKey(keys: CharacterKeys, action: KeyAction, slot: number): CharacterKeys {
	const own = listOf(keys, action);
	if (!(slot >= 0 && slot < own.length)) return keys;
	own.splice(slot, 1);
	return { ...keys, [action]: own };
}

/** The action `code` is bound to in `keys`, or `null`. Pure. */
export function actionOfKey(keys: CharacterKeys, code: string): KeyAction | null {
	return KEY_ACTIONS.find((a) => keys[a]?.includes(code)) ?? null;
}

/** Directions left without a key (the character can't move that way). Pure. */
export function unboundDirections(keys: CharacterKeys): KeyAction[] {
	return DIRECTIONS.filter((a) => (keys[a]?.length ?? 0) === 0);
}

const codeList = (v: unknown): string[] | null =>
	Array.isArray(v)
		? [...new Set(v.filter((c): c is string => typeof c === "string" && c.length > 0))]
		: null;

/**
 * Bindings read back from storage (`JSON.parse`d), laid over `base`: each action that is
 * a list of codes replaces base's, anything else keeps base's. Refused keys are dropped,
 * and a key is kept only on the first action that lists it. `null` for junk. Pure.
 */
export function parseStoredKeys(raw: unknown, base: CharacterKeys): CharacterKeys | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const obj = raw as Record<string, unknown>;
	const out: CharacterKeys = { ...base };
	const taken = new Set<string>();
	for (const a of KEY_ACTIONS) {
		const list = codeList(obj[a]) ?? [...(base[a] ?? [])];
		const kept = list.filter((c) => canBindKey(c, a) && !taken.has(c));
		for (const c of kept) taken.add(c);
		out[a] = kept;
	}
	return out;
}

/** Minimal Web Storage (so tests and SSR can pass a stand-in). */
export interface KeyStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

/** The browser's localStorage, or `null` where it is missing or blocked. */
export function defaultKeyStorage(): KeyStorage | null {
	try {
		return typeof localStorage !== "undefined" ? localStorage : null;
	} catch {
		return null;
	}
}

/** This viewer's saved bindings over `base`, or `null` when none are saved (or unreadable). */
export function loadStoredKeys(
	storage: KeyStorage | null,
	base: CharacterKeys,
): CharacterKeys | null {
	try {
		const text = storage?.getItem(KEYS_STORAGE_KEY);
		return text ? parseStoredKeys(JSON.parse(text), base) : null;
	} catch {
		return null;
	}
}

/** Save the bindings for this viewer (`null` forgets them). Failures are ignored. */
export function saveStoredKeys(storage: KeyStorage | null, keys: CharacterKeys | null): void {
	try {
		if (!storage) return;
		if (keys === null) storage.removeItem(KEYS_STORAGE_KEY);
		else {
			const out: Partial<Record<KeyAction, string[]>> = {};
			for (const a of KEY_ACTIONS) out[a] = [...(keys[a] ?? [])];
			storage.setItem(KEYS_STORAGE_KEY, JSON.stringify(out));
		}
	} catch {
		// Private mode / quota: the bindings still apply for this session.
	}
}
