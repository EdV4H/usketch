// Picking a key for a binding: while waiting, the next keydown goes only to us (no
// binding acts on it, and listeners after ours don't see it), and so does its keyup (a
// focused button that Space activates on keyup must not fire).
import type { Keymap } from "@edv4h/usketch-shared";

/**
 * Hand keydowns to `onKey` until it returns true (done) or the returned cancel is
 * called. The keymap's gate blocks every binding meanwhile (so a plugin that checks
 * `keymap.claims` / `resolveAll` leaves the key alone); the previous gate comes back
 * afterwards. Listens on `window` in the capture phase.
 */
export function captureKeys(keymap: Keymap, onKey: (event: KeyboardEvent) => boolean): () => void {
	if (typeof window === "undefined") return () => {};
	const previousGate = keymap.getGate();
	const block = (): boolean => false;
	keymap.setGate(block);
	/** Codes whose keydown we took: their keyup is ours too. */
	const taken = new Set<string>();
	let done = false;

	const onKeyDown = (e: KeyboardEvent): void => {
		e.preventDefault();
		e.stopImmediatePropagation();
		if (done) return;
		taken.add(e.code);
		if (e.repeat) return;
		if (onKey(e)) finish();
	};
	const onKeyUp = (e: KeyboardEvent): void => {
		if (!taken.delete(e.code)) return;
		e.preventDefault();
		e.stopImmediatePropagation();
		if (done && taken.size === 0) removeKeyUp();
	};
	const removeKeyUp = (): void => {
		window.removeEventListener("keyup", onKeyUp, true);
		window.removeEventListener("blur", removeKeyUp);
	};
	const finish = (): void => {
		if (done) return;
		done = true;
		window.removeEventListener("keydown", onKeyDown, true);
		// Unless someone set another gate meanwhile.
		if (keymap.getGate() === block) keymap.setGate(previousGate);
		// Keep swallowing the keyups of keys still down (until released or the window blurs).
		if (taken.size === 0) removeKeyUp();
	};

	window.addEventListener("keydown", onKeyDown, true);
	window.addEventListener("keyup", onKeyUp, true);
	window.addEventListener("blur", removeKeyUp);
	return finish;
}
