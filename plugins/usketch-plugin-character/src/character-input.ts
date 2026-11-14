// Continuous movement input. The keys are `"hold"` bindings in the app's keymap
// (`ctx.keymap`, ids in CHARACTER_KEY_IDS), matched by `event.code` (layout-independent,
// so WASD stays WASD on AZERTY and under IME), so they show up next to every other
// plugin's keys and viewers / hosts rebind them there. The keymap decides who gets a
// key (`when` = the character is on, `priority` above tool shortcuts and Mode 7's camera
// height keys); we still track keydown / keyup ourselves, in the CAPTURE phase. A key we
// take is also stopped there, for the listeners that aren't on the keymap yet.
import type { Keymap } from "@edv4h/usketch-shared";
import type { MoveInput } from "./character-physics.js";
import type { CharacterKeys } from "./character-types.js";

type KeyName = keyof CharacterKeys;

/** Keymap ids of the character's keys (rebind with `keymap.setKeys(id, codes)`). */
export const CHARACTER_KEY_IDS: Readonly<Record<KeyName, string>> = {
	up: "usketch-plugin-character:up",
	down: "usketch-plugin-character:down",
	left: "usketch-plugin-character:left",
	right: "usketch-plugin-character:right",
	drift: "usketch-plugin-character:drift",
	jump: "usketch-plugin-character:jump",
};

/**
 * Keymap priorities: above tool / shortcut keys (0) and Mode 7's camera height keys, and
 * among ours movement first, then the drift, then the jump (a key bound to both a drift
 * that is on and the jump drifts).
 */
export const CHARACTER_KEY_PRIORITY: Readonly<Record<KeyName, number>> = {
	up: 30,
	down: 30,
	left: 30,
	right: 30,
	drift: 21,
	jump: 20,
};

/** The order a held key is looked up in (and the bindings are registered in). */
const KEY_NAMES: readonly KeyName[] = ["up", "down", "left", "right", "drift", "jump"];

const BINDING_LABELS: Readonly<Record<KeyName, string>> = {
	up: "上 / 前進",
	down: "下 / 後退",
	left: "左",
	right: "右",
	drift: "ドリフト（車）",
	jump: "ジャンプ",
};

export interface KeyInput {
	/**
	 * The currently held directions (and the drift / jump keys). `jumpPressed` /
	 * `driftPressed` report a press since the previous `read()`, so a tap between two
	 * frames isn't lost.
	 */
	read(): MoveInput;
	/** The current key bindings. */
	getKeys(): CharacterKeys;
	/** The bindings before the viewer's changes (the keymap's defaults, host `keys` applied). */
	getDefaultKeys(): CharacterKeys;
	/** Whether any bound key is held. */
	anyHeld(): boolean;
	/**
	 * Replace the key bindings (held state is cleared). With a keymap this rebinds the
	 * keymap's bindings for the viewer (a key set back to its default is reset).
	 */
	setKeys(keys: CharacterKeys): void;
	/** Listen for binding changes (from `setKeys` or the keymap). Returns an unsubscribe. */
	onKeysChange(listener: () => void): () => void;
	/**
	 * Hand the next key press to `onKey` instead of the character (a key-config UI picking
	 * a binding): its `KeyboardEvent.code`, whatever the focus and whether the character is
	 * on, swallowed with its keyup. One press per call; a newer call replaces an older one.
	 * Returns a cancel.
	 */
	captureNextKey(onKey: (code: string) => void): () => void;
	dispose(): void;
}

/** `<input type>`s that don't take typed text (a focused HUD checkbox must not eat WASD). */
const NON_TEXT_INPUTS = new Set([
	"checkbox",
	"radio",
	"button",
	"submit",
	"reset",
	"range",
	"color",
	"file",
	"image",
]);

/** ARIA widgets Space activates or types into. */
const SPACE_ROLES = new Set([
	"button",
	"checkbox",
	"combobox",
	"link",
	"menuitem",
	"menuitemcheckbox",
	"menuitemradio",
	"option",
	"radio",
	"slider",
	"switch",
	"tab",
	"textbox",
]);

type FocusTarget = HTMLElement & {
	type?: string;
	getAttribute?: (n: string) => string | null;
	matches?: (selector: string) => boolean;
	querySelector?: (selector: string) => Element | null;
	parentElement?: FocusTarget | null;
};

const asElement = (target: EventTarget | null | undefined): FocusTarget | null => {
	const el = target as FocusTarget | null | undefined;
	return el && typeof el.tagName === "string" ? el : null;
};

/**
 * The focused element and its ancestors, innermost first. `composedPath()` reaches into
 * (open) shadow roots, so a web-component dialog or slider is seen as itself rather than
 * as its retargeted host; without it, the light-DOM parent chain.
 */
function focusPath(e: Event): FocusTarget[] {
	const raw = typeof e.composedPath === "function" ? e.composedPath() : [];
	const path = raw.map(asElement).filter((el): el is FocusTarget => el !== null);
	if (path.length > 0) return path;
	const chain: FocusTarget[] = [];
	for (let el = asElement(e.target); el; el = asElement(el.parentElement)) chain.push(el);
	return chain;
}

const roleOf = (el: FocusTarget | undefined): string | null =>
	el && typeof el.getAttribute === "function" ? el.getAttribute("role") : null;

/** Elements Space activates (or types into): the drift and jump keys must not steal it from them. */
function isSpaceTarget(el: FocusTarget | undefined): boolean {
	if (!el) return false;
	if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY"].includes(el.tagName)) return true;
	if (el.isContentEditable === true) return true;
	const role = roleOf(el);
	return role !== null && SPACE_ROLES.has(role);
}

/**
 * Overlays that own the keyboard while focus is inside them (a dialog or menu opened
 * mid-drive). Persistent containers such as a menubar or a sidebar listbox are not
 * here: their items are arrow-key widgets, which keep WASD driving.
 */
const KEY_OWNER_SELECTOR = 'dialog, [role="dialog"], [role="alertdialog"], [role="menu"]';

/** Marks the board's layers, to tell a host dialog that wraps the whole board apart. */
const BOARD_SELECTOR = "[data-layer-id]";

/** `<input type>`s that move their value or selection with the arrow keys. */
const ARROW_INPUTS = new Set(["range", "radio"]);

/** ARIA widgets (and composite containers that keep focus) that use the arrow keys. */
const ARROW_ROLES = new Set([
	"combobox",
	"grid",
	"gridcell",
	"listbox",
	"menubar",
	"menuitem",
	"menuitemcheckbox",
	"menuitemradio",
	"option",
	"radio",
	"radiogroup",
	"scrollbar",
	"separator",
	"slider",
	"spinbutton",
	"tab",
	"tablist",
	"toolbar",
	"tree",
	"treegrid",
	"treeitem",
]);

/**
 * Focus is inside a dialog or menu: every bound key is left to it. A dialog that holds
 * the board itself (the host shows the board in a modal) doesn't count, or the
 * character could never be driven there.
 */
function isInKeyOwner(path: readonly FocusTarget[]): boolean {
	const owner = path.find(
		(el) => typeof el.matches === "function" && el.matches(KEY_OWNER_SELECTOR),
	);
	if (!owner) return false;
	return typeof owner.querySelector !== "function" || owner.querySelector(BOARD_SELECTOR) === null;
}

/** The focused element uses the arrow keys itself, so arrow bindings are left to it. */
function isArrowTarget(el: FocusTarget | undefined): boolean {
	if (!el) return false;
	if (el.tagName === "INPUT" && ARROW_INPUTS.has((el.type ?? "").toLowerCase())) return true;
	const role = roleOf(el);
	return role !== null && ARROW_ROLES.has(role);
}

/** Whether a key acts as an arrow (by code, or by key: numpad 4/6 with NumLock off). */
const isArrowKey = (code: string, key: string | undefined): boolean =>
	code.startsWith("Arrow") || (key ?? "").startsWith("Arrow");

/** Focus where no bound key may be taken: typing, or a dialog / menu. */
function blocksAllKeys(path: readonly FocusTarget[]): boolean {
	return isTextInput(path[0]) || isInKeyOwner(path);
}

function isTextInput(el: FocusTarget | undefined): boolean {
	if (!el) return false;
	const tag = el.tagName;
	if (tag === "INPUT") return !NON_TEXT_INPUTS.has((el.type ?? "text").toLowerCase());
	return tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

/**
 * Listen for the bound keys on `window`. `isActive()` gates everything: while it is
 * false no key is captured (and none is swallowed). Keys are left alone while focus is
 * in a text field or inside a dialog / menu, arrow keys while a widget that uses them
 * (slider, radio, tab …) has focus, and the drift / jump keys on controls Space activates.
 * Held keys are cleared on window blur and tab hide, and released when focus moves to
 * a target that uses them, so a key released elsewhere can't get stuck "down".
 */
export function createKeyInput(
	initialKeys: CharacterKeys,
	isActive: () => boolean,
	/** Whether the drift key does anything now (else it is left to the host, e.g. Space-pan). */
	isDriftActive: () => boolean = () => false,
	/** Whether the jump key does anything now (else it is left to the host). */
	isJumpActive: () => boolean = () => false,
	/**
	 * The app's keymap (`ctx.keymap`): the keys are registered there as `"hold"` bindings
	 * with `initialKeys` as their defaults, and read back from it. Without one (an older
	 * host) the keys live here and the character takes them whenever it is on.
	 */
	keymap: Keymap | null = null,
): KeyInput {
	/** Whether each key does anything now (the bindings' `when`). */
	const live: Readonly<Record<KeyName, () => boolean>> = {
		up: isActive,
		down: isActive,
		left: isActive,
		right: isActive,
		drift: () => isActive() && isDriftActive(),
		jump: () => isActive() && isJumpActive(),
	};
	const listOf = (k: CharacterKeys, name: KeyName): string[] => [...(k[name] ?? [])];
	const fromKeymap = (map: Keymap): CharacterKeys => {
		const out = {} as CharacterKeys;
		for (const name of KEY_NAMES) out[name] = [...map.getKeys(CHARACTER_KEY_IDS[name])];
		return out;
	};

	const unregister: (() => void)[] = [];
	if (keymap) {
		for (const name of KEY_NAMES) {
			unregister.push(
				keymap.register({
					id: CHARACTER_KEY_IDS[name],
					kind: "hold",
					keys: listOf(initialKeys, name),
					label: BINDING_LABELS[name],
					category: "キャラクター",
					order: KEY_NAMES.indexOf(name),
					priority: CHARACTER_KEY_PRIORITY[name],
					when: live[name],
				}),
			);
		}
	}
	let keys = keymap ? fromKeymap(keymap) : initialKeys;
	/** Called when the bindings change (here or in the keymap). */
	const keyListeners = new Set<() => void>();
	const sameKeys = (a: CharacterKeys, b: CharacterKeys): boolean =>
		KEY_NAMES.every((n) => listOf(a, n).join() === listOf(b, n).join());

	/** Held codes → the `key` they produced (to tell numpad arrows from digits). */
	const held = new Map<string, string>();
	/** Held codes that act as the jump key (bound when pressed, so a rebind can't strand one). */
	const jumpHeld = new Set<string>();
	let jumpPressed = false;
	/** Held codes that act as the drift key (as for the jump). */
	const driftHeld = new Set<string>();
	let driftPressed = false;
	/** A pending `captureNextKey`. */
	let capture: ((code: string) => void) | null = null;
	/** Codes whose keydown a capture took: their keyup is swallowed too. */
	const captured = new Set<string>();

	const clear = (): void => {
		held.clear();
		jumpHeld.clear();
		jumpPressed = false;
		driftHeld.clear();
		driftPressed = false;
	};

	const offKeymap = keymap?.subscribe(() => {
		const next = fromKeymap(keymap);
		if (sameKeys(next, keys)) return;
		keys = next;
		clear();
		for (const l of [...keyListeners]) l();
	});

	/** Which of our keys this keydown is, if the character gets it. */
	const keyOf = (e: KeyboardEvent): KeyName | null => {
		if (keymap) {
			const winners = new Set(keymap.resolveAll(e).map((b) => b.id));
			return KEY_NAMES.find((n) => winners.has(CHARACTER_KEY_IDS[n])) ?? null;
		}
		return KEY_NAMES.find((n) => keys[n]?.includes(e.code) && live[n]()) ?? null;
	};

	/** Keys Space activates on buttons etc.: the drift and jump keys yield to those. */
	const isSpaceLike = (code: string): boolean =>
		(keys.drift?.includes(code) ?? false) || (keys.jump?.includes(code) ?? false);

	const onKeyDown = (e: KeyboardEvent): void => {
		if (capture) {
			const onKey = capture;
			capture = null;
			captured.add(e.code);
			e.preventDefault();
			e.stopImmediatePropagation();
			onKey(e.code);
			return;
		}
		if (captured.has(e.code)) {
			// Auto-repeat of a key a capture just took.
			e.preventDefault();
			e.stopImmediatePropagation();
			return;
		}
		if (!isActive()) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return; // leave chords (Cmd+S …) alone
		const dir = keyOf(e);
		if (!dir) return;
		const path = focusPath(e);
		if (blocksAllKeys(path)) return;
		if ((dir === "drift" || dir === "jump") && isSpaceTarget(path[0])) return;
		if (isArrowKey(e.code, e.key) && isArrowTarget(path[0])) return;
		held.set(e.code, e.key ?? "");
		if (dir === "jump") {
			// Auto-repeat keydowns are not new presses.
			if (!e.repeat && !jumpHeld.has(e.code)) jumpPressed = true;
			jumpHeld.add(e.code);
		} else if (dir === "drift") {
			if (!e.repeat && !driftHeld.has(e.code)) driftPressed = true;
			driftHeld.add(e.code);
		}
		e.preventDefault();
		e.stopImmediatePropagation();
	};

	const release = (code: string): boolean => {
		jumpHeld.delete(code);
		driftHeld.delete(code);
		return held.delete(code);
	};

	const onKeyUp = (e: KeyboardEvent): void => {
		if (captured.delete(e.code)) {
			e.preventDefault();
			e.stopImmediatePropagation();
			return;
		}
		if (!release(e.code)) return;
		e.preventDefault();
		e.stopImmediatePropagation();
	};

	const onVisibility = (): void => {
		if (typeof document !== "undefined" && document.hidden) clear();
	};
	// Focus moving to a target that uses a held key hands that key to it: release it, or
	// the character keeps going and the key's keyup is swallowed (a button that Space
	// activates on keyup would never fire). Keys the new target ignores stay held.
	const onFocusIn = (e: FocusEvent): void => {
		const path = focusPath(e);
		if (blocksAllKeys(path)) {
			clear();
			return;
		}
		const owned = [...held].filter(
			([code, key]) =>
				(isArrowKey(code, key) && isArrowTarget(path[0])) ||
				(isSpaceLike(code) && isSpaceTarget(path[0])),
		);
		for (const [code] of owned) release(code);
	};

	const hasWindow = typeof window !== "undefined";
	if (hasWindow) {
		window.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("keyup", onKeyUp, true);
		window.addEventListener("blur", clear);
		document.addEventListener("visibilitychange", onVisibility);
		document.addEventListener("focusin", onFocusIn);
	}

	const isHeld = (dir: keyof CharacterKeys) => keys[dir]?.some((c) => held.has(c)) ?? false;

	return {
		read: () => {
			const pressed = jumpPressed;
			jumpPressed = false;
			const drifted = driftPressed && isDriftActive();
			driftPressed = false;
			return {
				up: isHeld("up"),
				down: isHeld("down"),
				left: isHeld("left"),
				right: isHeld("right"),
				// A key bound to both acts as the drift while drift is on (its higher priority).
				drift: isDriftActive() && isHeld("drift"),
				jump: jumpHeld.size > 0,
				jumpPressed: pressed,
				driftPressed: drifted,
			};
		},
		getKeys: () => keys,
		getDefaultKeys() {
			if (!keymap) return initialKeys;
			const out = {} as CharacterKeys;
			for (const name of KEY_NAMES) {
				out[name] = [...(keymap.get(CHARACTER_KEY_IDS[name])?.defaultKeys ?? [])];
			}
			return out;
		},
		anyHeld: () => held.size > 0,
		setKeys(next) {
			// Rebinding movement keeps the drift / jump keys unless given (`[]` unbinds).
			const merged = { ...next, drift: next.drift ?? keys.drift, jump: next.jump ?? keys.jump };
			if (!keymap) {
				keys = merged;
				clear();
				for (const l of [...keyListeners]) l();
				return;
			}
			// A key back at its default is a reset, so the viewer's overrides stay minimal.
			for (const name of KEY_NAMES) {
				const id = CHARACTER_KEY_IDS[name];
				const want = listOf(merged, name);
				const def = keymap.get(id)?.defaultKeys ?? [];
				if (want.join() === def.join()) keymap.resetKeys(id);
				else if (want.join() !== keymap.getKeys(id).join()) keymap.setKeys(id, want);
			}
		},
		onKeysChange(listener) {
			keyListeners.add(listener);
			return () => {
				keyListeners.delete(listener);
			};
		},
		captureNextKey(onKey) {
			capture = onKey;
			return () => {
				if (capture === onKey) capture = null;
			};
		},
		dispose() {
			offKeymap?.();
			for (const off of unregister) off();
			keyListeners.clear();
			if (!hasWindow) return;
			capture = null;
			window.removeEventListener("keydown", onKeyDown, true);
			window.removeEventListener("keyup", onKeyUp, true);
			window.removeEventListener("blur", clear);
			document.removeEventListener("visibilitychange", onVisibility);
			document.removeEventListener("focusin", onFocusIn);
		},
	};
}
