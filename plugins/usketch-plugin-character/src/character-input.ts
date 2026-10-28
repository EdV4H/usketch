// Continuous movement input. `ctx.shortcuts` only fires discrete keydowns (no
// keyup), so we track held keys ourselves: window keydown/keyup in the CAPTURE
// phase, matched by `event.code` (layout-independent, so WASD stays WASD on AZERTY
// and under IME). Bound keys are swallowed while active so the host's single-letter
// tool shortcuts (e.g. `a`, `d`) don't also fire.
import type { MoveInput } from "./character-physics.js";
import type { CharacterKeys } from "./character-types.js";

export interface KeyInput {
	/**
	 * The currently held directions (and the drift / jump keys). `jumpPressed` reports
	 * a jump press since the previous `read()`, so a tap between two frames isn't lost.
	 */
	read(): MoveInput;
	/** Whether any bound key is held. */
	anyHeld(): boolean;
	/** Replace the key bindings (held state is cleared). */
	setKeys(keys: CharacterKeys): void;
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
): KeyInput {
	let keys = initialKeys;
	/** Held codes → the `key` they produced (to tell numpad arrows from digits). */
	const held = new Map<string, string>();
	/** Held codes that act as the jump key (bound when pressed, so a rebind can't strand one). */
	const jumpHeld = new Set<string>();
	let jumpPressed = false;

	const directionOf = (code: string): keyof CharacterKeys | null => {
		for (const dir of ["up", "down", "left", "right"] as const) {
			if (keys[dir].includes(code)) return dir;
		}
		if (keys.drift?.includes(code) && isDriftActive()) return "drift";
		if (keys.jump?.includes(code) && isJumpActive()) return "jump";
		return null;
	};

	/** Keys Space activates on buttons etc.: the drift and jump keys yield to those. */
	const isSpaceLike = (code: string): boolean =>
		(keys.drift?.includes(code) ?? false) || (keys.jump?.includes(code) ?? false);

	const onKeyDown = (e: KeyboardEvent): void => {
		if (!isActive()) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return; // leave chords (Cmd+S …) alone
		const dir = directionOf(e.code);
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
		}
		e.preventDefault();
		e.stopImmediatePropagation();
	};

	const release = (code: string): boolean => {
		jumpHeld.delete(code);
		return held.delete(code);
	};

	const onKeyUp = (e: KeyboardEvent): void => {
		if (!release(e.code)) return;
		e.preventDefault();
		e.stopImmediatePropagation();
	};

	const clear = (): void => {
		held.clear();
		jumpHeld.clear();
		jumpPressed = false;
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
			return {
				up: isHeld("up"),
				down: isHeld("down"),
				left: isHeld("left"),
				right: isHeld("right"),
				// A key bound to both acts as the drift while drift is on (directionOf).
				drift: isDriftActive() && isHeld("drift"),
				jump: jumpHeld.size > 0,
				jumpPressed: pressed,
			};
		},
		anyHeld: () => held.size > 0,
		setKeys(next) {
			// Rebinding movement keeps the drift / jump keys unless given (`[]` unbinds).
			keys = { ...next, drift: next.drift ?? keys.drift, jump: next.jump ?? keys.jump };
			clear();
		},
		dispose() {
			if (!hasWindow) return;
			window.removeEventListener("keydown", onKeyDown, true);
			window.removeEventListener("keyup", onKeyUp, true);
			window.removeEventListener("blur", clear);
			document.removeEventListener("visibilitychange", onVisibility);
			document.removeEventListener("focusin", onFocusIn);
		},
	};
}
