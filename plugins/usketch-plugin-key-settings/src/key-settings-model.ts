// The rules behind the "キー設定" panel, as pure functions over the app's keymap: how
// bindings are grouped and named, which other bindings share a key, and what a key
// pressed while picking does. No DOM and no React (the panel only draws these).
import {
	assignKey,
	bindingsUsingKey,
	type ComboOptions,
	comboFromKeyEvent,
	isReservedCombo,
	type ReservedComboOptions,
} from "@edv4h/usketch-core";
import type { KeyBinding, Keymap } from "@edv4h/usketch-shared";

/** How many keys the panel lets one binding have. */
export const MAX_KEYS_PER_BINDING = 3;

const CATEGORY_NAMES: Readonly<Record<string, string>> = {
	tool: "ツール",
};

/** A binding's name in the panel: its label, else the last part of its id. */
export function bindingName(binding: KeyBinding): string {
	if (binding.label) return binding.label;
	const parts = binding.id.split(":");
	return parts[parts.length - 1] || binding.id;
}

export interface KeySettingsGroup {
	title: string;
	bindings: KeyBinding[];
}

/**
 * Bindings grouped by `category` (else by the owning plugin's name), groups in the order
 * they first appear in `bindings`, bindings within a group by `order` and then name.
 * `filter` keeps bindings whose name, group, plugin or keys contain it (case-insensitive).
 */
export function groupBindings(
	bindings: readonly KeyBinding[],
	pluginName: (pluginId: string | undefined) => string | undefined = () => undefined,
	filter = "",
): KeySettingsGroup[] {
	const needle = filter.trim().toLowerCase();
	const groups = new Map<string, KeyBinding[]>();
	for (const binding of bindings) {
		const plugin = pluginName(binding.pluginId) ?? binding.pluginId ?? "";
		const title = binding.category
			? (CATEGORY_NAMES[binding.category] ?? binding.category)
			: plugin || "その他";
		if (needle) {
			const haystack = [bindingName(binding), title, plugin, binding.id, ...binding.keys]
				.join(" ")
				.toLowerCase();
			if (!haystack.includes(needle)) continue;
		}
		const list = groups.get(title);
		if (list) list.push(binding);
		else groups.set(title, [binding]);
	}
	return [...groups].map(([title, list]) => ({
		title,
		bindings: [...list].sort(
			(a, b) =>
				(a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY) ||
				bindingName(a).localeCompare(bindingName(b)),
		),
	}));
}

/** The other bindings that use `key` of `binding` (an overlap, decided by the keymap). */
export function sharersOf(keymap: Keymap, binding: KeyBinding, key: string): KeyBinding[] {
	return bindingsUsingKey(keymap, key, binding.kind, binding.id);
}

/** Held keys (`KeyboardEvent.code`) the panel won't bind: focus moves and OS chords. */
const REFUSED_HOLD_CODES = new Set([
	"Escape",
	"Tab",
	"MetaLeft",
	"MetaRight",
	"ControlLeft",
	"ControlRight",
	"OSLeft",
	"OSRight",
]);

export type PickResult =
	/** Esc: nothing changed. */
	| { type: "cancel" }
	/** Only modifiers are down so far: keep waiting. */
	| { type: "wait" }
	/** Delete / Backspace on a key: it was taken off. */
	| { type: "removed"; key: string }
	/** The key can't be bound (reserved, or the binding isn't customizable). */
	| { type: "refused"; key: string }
	| {
			type: "assigned";
			key: string;
			/** Bindings of the same plugin the key was moved off. */
			movedFrom: KeyBinding[];
			/** Other plugins' bindings that still use it (the keymap decides between them). */
			sharedWith: KeyBinding[];
	  };

export interface PickOptions extends ComboOptions, ReservedComboOptions {}

/**
 * A key pressed while picking slot `slot` of binding `id`: Esc cancels, Delete /
 * Backspace takes the slot's key off, any other key goes into the slot (`"press"`
 * bindings store the combo, `"hold"` bindings the `KeyboardEvent.code`). A key one of
 * the same plugin's other bindings had moves here (as rebinding within one plugin
 * always did); other plugins keep theirs and the overlap is reported.
 */
export function applyPickedKey(
	keymap: Keymap,
	id: string,
	slot: number,
	event: KeyboardEvent,
	options: PickOptions = {},
): PickResult {
	const plain = !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
	if (event.key === "Escape" && plain) return { type: "cancel" };
	const binding = keymap.get(id);
	if (!binding) return { type: "cancel" };
	if (plain && (event.key === "Delete" || event.key === "Backspace")) {
		const old = binding.keys[slot];
		if (old === undefined) return { type: "cancel" };
		if (!binding.customizable) return { type: "refused", key: old };
		keymap.setKeys(
			id,
			binding.keys.filter((_, i) => i !== slot),
		);
		return { type: "removed", key: old };
	}

	let key: string;
	if (binding.kind === "hold") {
		if (!event.code) return { type: "wait" };
		key = event.code;
		if (REFUSED_HOLD_CODES.has(key)) return { type: "refused", key };
	} else {
		const combo = comboFromKeyEvent(event, options);
		if (combo === null) return { type: "wait" };
		key = combo;
		if (isReservedCombo(combo, options)) return { type: "refused", key };
	}
	if (!binding.customizable) return { type: "refused", key };

	const token = keymap.normalizeKey(key, binding.kind);
	const movedFrom: KeyBinding[] = [];
	for (const other of sharersOf(keymap, binding, key)) {
		if (other.pluginId !== binding.pluginId || !other.customizable) continue;
		keymap.setKeys(
			other.id,
			other.keys.filter((k) => keymap.normalizeKey(k, other.kind) !== token),
		);
		movedFrom.push(other);
	}
	const result = assignKey(keymap, id, key, { slot });
	if (!result.ok) return { type: "refused", key };
	const sharedWith = sharersOf(keymap, binding, key);
	return { type: "assigned", key, movedFrom, sharedWith };
}
