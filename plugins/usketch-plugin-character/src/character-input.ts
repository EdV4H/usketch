// Continuous movement input. `ctx.shortcuts` only fires discrete keydowns (no
// keyup), so we track held keys ourselves: window keydown/keyup in the CAPTURE
// phase, matched by `event.code` (layout-independent, so WASD stays WASD on AZERTY
// and under IME). Bound keys are swallowed while active so the host's single-letter
// tool shortcuts (e.g. `a`, `d`) don't also fire.
import type { MoveInput } from "./character-physics.js";
import type { CharacterKeys } from "./character-types.js";

export interface KeyInput {
	/** The currently held directions (and the drift key). */
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
	closest?: (selector: string) => Element | null;
};

const asElement = (target: EventTarget | null): FocusTarget | null => {
	const el = target as FocusTarget | null;
	return el && typeof el.tagName === "string" ? el : null;
};

/** Elements Space activates (or types into): the drift key must not steal it from them. */
function isSpaceTarget(target: EventTarget | null): boolean {
	const el = asElement(target);
	if (!el) return false;
	if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY"].includes(el.tagName)) return true;
	if (el.isContentEditable === true) return true;
	const role = typeof el.getAttribute === "function" ? el.getAttribute("role") : null;
	return role !== null && SPACE_ROLES.has(role);
}

/** Containers that own the keyboard while focus is inside them (a dialog opened mid-drive). */
const KEY_OWNER_SELECTOR =
	'dialog, [role="dialog"], [role="alertdialog"], [role="menu"], [role="menubar"], [role="listbox"]';

/** `<input type>`s that move their value or selection with the arrow keys. */
const ARROW_INPUTS = new Set(["range", "radio"]);

/** ARIA widgets that use the arrow keys (radio groups, tabs, sliders, trees, grids …). */
const ARROW_ROLES = new Set([
	"gridcell",
	"listbox",
	"menuitem",
	"menuitemcheckbox",
	"menuitemradio",
	"option",
	"radio",
	"scrollbar",
	"slider",
	"spinbutton",
	"tab",
	"tree",
	"treeitem",
]);

/** Focus is inside a dialog or menu: every bound key is left to it. */
function isInKeyOwner(target: EventTarget | null): boolean {
	const el = asElement(target);
	return typeof el?.closest === "function" && el.closest(KEY_OWNER_SELECTOR) !== null;
}

/** The focused element uses the arrow keys itself, so arrow bindings are left to it. */
function isArrowTarget(target: EventTarget | null): boolean {
	const el = asElement(target);
	if (!el) return false;
	if (el.tagName === "INPUT" && ARROW_INPUTS.has((el.type ?? "").toLowerCase())) return true;
	const role = typeof el.getAttribute === "function" ? el.getAttribute("role") : null;
	return role !== null && ARROW_ROLES.has(role);
}

/** Focus where no bound key may be taken: typing, or a dialog / menu. */
function blocksAllKeys(target: EventTarget | null): boolean {
	return isTextInput(target) || isInKeyOwner(target);
}

function isTextInput(target: EventTarget | null): boolean {
	const el = asElement(target);
	if (!el) return false;
	const tag = el.tagName;
	if (tag === "INPUT") return !NON_TEXT_INPUTS.has((el.type ?? "text").toLowerCase());
	return tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

/**
 * Listen for the bound keys on `window`. `isActive()` gates everything: while it is
 * false no key is captured (and none is swallowed). Keys are left alone while focus is
 * in a text field or inside a dialog / menu, and arrow keys while a widget that uses
 * them (slider, radio, tab …) has focus. Held keys are cleared on window blur, tab hide
 * and focus moving into such a target, so a key released elsewhere can't get stuck "down".
 */
export function createKeyInput(
	initialKeys: CharacterKeys,
	isActive: () => boolean,
	/** Whether the drift key does anything now (else it is left to the host, e.g. Space-pan). */
	isDriftActive: () => boolean = () => false,
): KeyInput {
	let keys = initialKeys;
	const held = new Set<string>();

	const directionOf = (code: string): keyof CharacterKeys | null => {
		for (const dir of ["up", "down", "left", "right"] as const) {
			if (keys[dir].includes(code)) return dir;
		}
		if (keys.drift?.includes(code) && isDriftActive()) return "drift";
		return null;
	};

	const onKeyDown = (e: KeyboardEvent): void => {
		if (!isActive() || blocksAllKeys(e.target)) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return; // leave chords (Cmd+S …) alone
		const dir = directionOf(e.code);
		if (!dir) return;
		if (dir === "drift" && isSpaceTarget(e.target)) return;
		if (e.code.startsWith("Arrow") && isArrowTarget(e.target)) return;
		held.add(e.code);
		e.preventDefault();
		e.stopImmediatePropagation();
	};

	const onKeyUp = (e: KeyboardEvent): void => {
		if (!held.delete(e.code)) return;
		e.preventDefault();
		e.stopImmediatePropagation();
	};

	const clear = (): void => held.clear();
	const onVisibility = (): void => {
		if (typeof document !== "undefined" && document.hidden) clear();
	};
	// Focus moving into a field, dialog or arrow-key widget hands the keyboard to it:
	// drop what is held so the character doesn't keep driving on a key the new target now
	// receives (its keyup would no longer reach us as a bound key).
	const onFocusIn = (e: FocusEvent): void => {
		if (blocksAllKeys(e.target) || isArrowTarget(e.target)) clear();
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
		read: () => ({
			up: isHeld("up"),
			down: isHeld("down"),
			left: isHeld("left"),
			right: isHeld("right"),
			drift: isHeld("drift"),
		}),
		anyHeld: () => held.size > 0,
		setKeys(next) {
			// Rebinding movement keeps the drift key unless `drift` is given (`[]` unbinds).
			keys = { ...next, drift: next.drift ?? keys.drift };
			held.clear();
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
