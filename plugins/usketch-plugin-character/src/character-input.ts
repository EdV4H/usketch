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

/** Elements Space activates (or types into): the drift key must not steal it from them. */
function isSpaceTarget(target: EventTarget | null): boolean {
	const el = target as (HTMLElement & { getAttribute?: (n: string) => string | null }) | null;
	if (!el || typeof el.tagName !== "string") return false;
	if (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY"].includes(el.tagName)) return true;
	if (el.isContentEditable === true) return true;
	const role = typeof el.getAttribute === "function" ? el.getAttribute("role") : null;
	return role !== null && SPACE_ROLES.has(role);
}

function isTextInput(target: EventTarget | null): boolean {
	const el = target as (HTMLElement & { type?: string }) | null;
	if (!el || typeof el.tagName !== "string") return false;
	const tag = el.tagName;
	if (tag === "INPUT") return !NON_TEXT_INPUTS.has((el.type ?? "text").toLowerCase());
	return tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

/**
 * Listen for the bound keys on `window`. `isActive()` gates everything: while it is
 * false no key is captured (and none is swallowed). Held keys are cleared on window
 * blur / tab hide so a key released elsewhere can't get stuck "down".
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
		if (!isActive() || isTextInput(e.target)) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return; // leave chords (Cmd+S …) alone
		const dir = directionOf(e.code);
		if (!dir) return;
		if (dir === "drift" && isSpaceTarget(e.target)) return;
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

	const hasWindow = typeof window !== "undefined";
	if (hasWindow) {
		window.addEventListener("keydown", onKeyDown, true);
		window.addEventListener("keyup", onKeyUp, true);
		window.addEventListener("blur", clear);
		document.addEventListener("visibilitychange", onVisibility);
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
		},
	};
}
