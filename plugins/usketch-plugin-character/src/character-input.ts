// Continuous movement input. `ctx.shortcuts` only fires discrete keydowns (no
// keyup), so we track held keys ourselves: window keydown/keyup in the CAPTURE
// phase, matched by `event.code` (layout-independent, so WASD stays WASD on AZERTY
// and under IME). Bound keys are swallowed while active so the host's single-letter
// tool shortcuts (e.g. `a`, `d`) don't also fire.
import type { MoveInput } from "./character-physics.js";
import type { CharacterKeys } from "./character-types.js";

export interface KeyInput {
	/** The currently held directions. */
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
export function createKeyInput(initialKeys: CharacterKeys, isActive: () => boolean): KeyInput {
	let keys = initialKeys;
	const held = new Set<string>();

	const directionOf = (code: string): keyof CharacterKeys | null => {
		for (const dir of ["up", "down", "left", "right"] as const) {
			if (keys[dir].includes(code)) return dir;
		}
		return null;
	};

	const onKeyDown = (e: KeyboardEvent): void => {
		if (!isActive() || isTextInput(e.target)) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return; // leave chords (Cmd+S …) alone
		if (!directionOf(e.code)) return;
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

	const isHeld = (dir: keyof CharacterKeys) => keys[dir].some((c) => held.has(c));

	return {
		read: () => ({
			up: isHeld("up"),
			down: isHeld("down"),
			left: isHeld("left"),
			right: isHeld("right"),
		}),
		anyHeld: () => held.size > 0,
		setKeys(next) {
			keys = next;
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
