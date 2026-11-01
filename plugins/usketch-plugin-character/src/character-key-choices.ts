// The keys the HUD offers for the jump and the drift: a short list of keys that don't
// clash with the default movement keys (WASD). Any other binding can still be set from
// code (`setKeys`); the HUD then shows it as none of these. Pure.
import type { CharacterKeys } from "./character-types.js";

export interface KeyChoice {
	/** HUD option value. */
	value: string;
	label: string;
	/** `KeyboardEvent.code` values it binds. */
	codes: readonly string[];
}

export const KEY_CHOICES: readonly KeyChoice[] = [
	{ value: "space", label: "Space", codes: ["Space"] },
	{ value: "shift", label: "Shift", codes: ["ShiftLeft", "ShiftRight"] },
	{ value: "z", label: "Z", codes: ["KeyZ"] },
	{ value: "x", label: "X", codes: ["KeyX"] },
	{ value: "c", label: "C", codes: ["KeyC"] },
	{ value: "j", label: "J", codes: ["KeyJ"] },
	{ value: "k", label: "K", codes: ["KeyK"] },
	{ value: "l", label: "L", codes: ["KeyL"] },
];

/** The choice whose codes are exactly `codes` (in any order), or `null`. */
export function keyChoiceOf(codes: readonly string[] | undefined): KeyChoice | null {
	if (!codes) return null;
	const set = new Set(codes);
	return (
		KEY_CHOICES.find((c) => c.codes.length === set.size && c.codes.every((k) => set.has(k))) ?? null
	);
}

/** `keys` with the jump or drift key set to the choice `value` (unchanged for an unknown one). */
export function withKeyChoice(
	keys: CharacterKeys,
	action: "jump" | "drift",
	value: string,
): CharacterKeys {
	const choice = KEY_CHOICES.find((c) => c.value === value);
	return choice ? { ...keys, [action]: [...choice.codes] } : keys;
}
