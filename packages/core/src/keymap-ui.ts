// Headless helpers for key-settings UIs (a settings panel, a cheat sheet): how a key is
// shown, which keys a viewer may not take, reading a pressed key for rebinding, and
// moving keys between bindings. No DOM / React: a host with its own design system (or
// the HUD key panel) renders on top of these.
import type { KeyBinding, KeyBindingKind, Keymap } from "@edv4h/usketch-shared";
import { type ComboOptions, codeToKey, normalizeCombo } from "./keymap.js";

const MODIFIERS = new Set(["mod", "ctrl", "meta", "shift", "alt"]);

const detectMac = (): boolean =>
	typeof navigator !== "undefined" &&
	/Mac|iPhone|iPad|iPod/.test(
		(navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
			navigator.platform ??
			"",
	);

const KEY_LABELS: Record<string, string> = {
	space: "Space",
	escape: "Esc",
	enter: "Enter",
	tab: "Tab",
	backspace: "Backspace",
	delete: "Delete",
	arrowup: "↑",
	arrowdown: "↓",
	arrowleft: "←",
	arrowright: "→",
	pageup: "PageUp",
	pagedown: "PageDown",
	home: "Home",
	end: "End",
};

const MAC_KEY_LABELS: Record<string, string> = {
	enter: "↩",
	backspace: "⌫",
	delete: "⌦",
	escape: "⎋",
	tab: "⇥",
};

const keyLabel = (key: string, isMac: boolean): string =>
	(isMac ? MAC_KEY_LABELS[key] : undefined) ??
	KEY_LABELS[key] ??
	(key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1));

export interface FormatComboOptions {
	/** Default: detected from `navigator`. */
	isMac?: boolean;
}

/**
 * A combo for display: `"Mod+Shift+Z"` → `⇧⌘Z` on macOS (Apple's ⌃⌥⇧⌘ order) and
 * `Ctrl+Shift+Z` elsewhere. `Shift+/` is shown as `?`.
 */
export function formatCombo(combo: string, options: FormatComboOptions = {}): string {
	const isMac = options.isMac ?? detectMac();
	const tokens = new Set(normalizeCombo(combo).split("+").filter(Boolean));
	if (tokens.size === 2 && tokens.has("shift") && tokens.has("/")) return "?";
	const key = [...tokens].find((t) => !MODIFIERS.has(t));
	const ctrl = tokens.has("ctrl") || (!isMac && tokens.has("mod"));
	const cmd = tokens.has("meta") || (isMac && tokens.has("mod"));
	const label = key ? keyLabel(key, isMac) : "";
	if (isMac) {
		return (
			(ctrl ? "⌃" : "") +
			(tokens.has("alt") ? "⌥" : "") +
			(tokens.has("shift") ? "⇧" : "") +
			(cmd ? "⌘" : "") +
			label
		);
	}
	const parts: string[] = [];
	if (ctrl) parts.push("Ctrl");
	if (cmd) parts.push("Meta");
	if (tokens.has("alt")) parts.push("Alt");
	if (tokens.has("shift")) parts.push("Shift");
	if (label) parts.push(label);
	return parts.join("+");
}

export interface FormatKeyCodeOptions extends FormatComboOptions {
	/**
	 * Prefixes for the left / right copy of a modifier (`ShiftLeft` …), so two bindings
	 * on either side read apart. Default `{ left: "Left ", right: "Right " }`.
	 */
	sides?: { left: string; right: string };
}

/**
 * A held key (`KeyboardEvent.code`) for display: `"KeyW"` → `W`, `"ShiftLeft"` →
 * `Left Shift` (`Left ⇧` on macOS).
 */
export function formatKeyCode(code: string, options: FormatKeyCodeOptions = {}): string {
	const key = codeToKey(code);
	const label = formatCombo(key, options);
	const side = /^(?:Shift|Control|Alt|Meta|OS)(Left|Right)$/.exec(code)?.[1];
	if (!side) return label;
	const sides = options.sides ?? { left: "Left ", right: "Right " };
	return `${side === "Left" ? sides.left : sides.right}${label}`;
}

/** {@link formatCombo} or {@link formatKeyCode}, by the binding's kind. */
export function formatBindingKey(
	kind: KeyBindingKind,
	key: string,
	options: FormatKeyCodeOptions = {},
): string {
	return kind === "hold" ? formatKeyCode(key, options) : formatCombo(key, options);
}

/** Browser / OS shortcuts a page can't (or shouldn't) take over. */
export const DEFAULT_RESERVED_COMBOS: readonly string[] = [
	"Mod+W",
	"Mod+T",
	"Mod+N",
	"Mod+Q",
	"Mod+R",
	"Escape",
	"Tab",
];

export interface ReservedComboOptions {
	/** Combos viewers may not bind (default {@link DEFAULT_RESERVED_COMBOS}). */
	reserved?: readonly string[];
	/** Whether a key without Mod / Ctrl / Meta / Alt / Shift may be bound (default true). */
	allowBareKeys?: boolean;
}

/**
 * Whether a viewer may not bind `combo` (a `"press"` combo): modifier-only or several
 * keys at once, a bare key when `allowBareKeys` is false, or one of `reserved`.
 */
export function isReservedCombo(combo: string, options: ReservedComboOptions = {}): boolean {
	const canonical = normalizeCombo(combo);
	const tokens = canonical.split("+").filter(Boolean);
	const keys = tokens.filter((t) => !MODIFIERS.has(t));
	if (keys.length !== 1) return true;
	if (options.allowBareKeys === false && keys.length === tokens.length) return true;
	const reserved = options.reserved ?? DEFAULT_RESERVED_COMBOS;
	return reserved.some((r) => normalizeCombo(r) === canonical);
}

/**
 * The combo to store when a viewer presses a key to rebind a `"press"` binding, in
 * {@link normalizeCombo} form (platform-independent: the accelerator becomes `mod`).
 * Shifted symbols / digits are read by physical key (`Shift+1`, not `Shift+!`).
 * Returns null while only modifiers are down.
 */
export function comboFromKeyEvent(event: KeyboardEvent, options: ComboOptions = {}): string | null {
	const mode = options.mod ?? "platform";
	const isMac = options.isMac ?? detectMac();
	const tokens: string[] = [];
	if (mode === "either") {
		if (event.ctrlKey || event.metaKey) tokens.push("mod");
	} else {
		const accel = isMac ? event.metaKey : event.ctrlKey;
		const other = isMac ? event.ctrlKey : event.metaKey;
		if (accel) tokens.push("mod");
		if (other) tokens.push(isMac ? "ctrl" : "meta");
	}
	if (event.shiftKey) tokens.push("shift");
	if (event.altKey) tokens.push("alt");
	const raw = (event.key ?? "").toLowerCase();
	if (["control", "meta", "shift", "alt", "os", "altgraph", ""].includes(raw)) return null;
	const code = event.code ?? "";
	const physical = code ? codeToKey(code) : "";
	const usePhysical =
		physical &&
		physical !== code.toLowerCase() &&
		(event.shiftKey || event.altKey || !/^[a-z0-9]$/.test(raw));
	tokens.push(usePhysical ? physical : raw === " " ? "space" : raw);
	return normalizeCombo(tokens.join("+"));
}

/** Bindings (other than `exceptId`) that use `key`, as the keymap's overlap check sees it. */
export function bindingsUsingKey(
	keymap: Keymap,
	key: string,
	kind: KeyBindingKind = "press",
	exceptId?: string,
): KeyBinding[] {
	const token = keymap.normalizeKey(key, kind);
	return keymap
		.getAll()
		.filter(
			(b) => b.id !== exceptId && b.keys.some((k) => keymap.normalizeKey(k, b.kind) === token),
		);
}

export interface AssignKeyOptions {
	/** Replace the key at this position (default: add it after the others). */
	slot?: number;
	/**
	 * Take the key away from the other (customizable) bindings that use it, so it isn't
	 * shared (default false: keep the overlap and let the conflict policy decide).
	 */
	steal?: boolean;
}

export interface AssignKeyResult {
	/** False when the binding is unknown or not customizable (nothing changed). */
	ok: boolean;
	/** Ids the key was taken from (`steal`). */
	stolenFrom: string[];
	/** Ids that still share the key afterwards (not customizable, or `steal` off). */
	sharedWith: string[];
}

/** Bind `key` to `id` for the viewer (see {@link AssignKeyOptions}). */
export function assignKey(
	keymap: Keymap,
	id: string,
	key: string,
	options: AssignKeyOptions = {},
): AssignKeyResult {
	const binding = keymap.get(id);
	if (!binding?.customizable) return { ok: false, stolenFrom: [], sharedWith: [] };
	const token = keymap.normalizeKey(key, binding.kind);
	const same = (k: string, kind: KeyBindingKind): boolean => keymap.normalizeKey(k, kind) === token;

	const stolenFrom: string[] = [];
	const sharedWith: string[] = [];
	for (const other of bindingsUsingKey(keymap, key, binding.kind, id)) {
		if (options.steal && other.customizable) {
			keymap.setKeys(
				other.id,
				other.keys.filter((k) => !same(k, other.kind)),
			);
			stolenFrom.push(other.id);
		} else {
			sharedWith.push(other.id);
		}
	}

	// One entry per key: drop an older copy, then put the key in its slot (or last).
	const slot = options.slot;
	const keys = binding.keys.map((k, i) => (i === slot ? null : k));
	const kept = keys.filter((k): k is string => k !== null && !same(k, binding.kind));
	const at =
		slot !== undefined && slot >= 0 && slot < binding.keys.length
			? keys.slice(0, slot).filter((k) => k !== null && !same(k, binding.kind)).length
			: kept.length;
	kept.splice(at, 0, key);
	keymap.setKeys(id, kept);
	return { ok: true, stolenFrom, sharedWith };
}

/** Remove `key` from `id` for the viewer. Returns false when nothing changed. */
export function unassignKey(keymap: Keymap, id: string, key: string): boolean {
	const binding = keymap.get(id);
	if (!binding?.customizable) return false;
	const token = keymap.normalizeKey(key, binding.kind);
	const keys = binding.keys.filter((k) => keymap.normalizeKey(k, binding.kind) !== token);
	if (keys.length === binding.keys.length) return false;
	keymap.setKeys(id, keys);
	return true;
}
