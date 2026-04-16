import type { EventBus } from "@edv4h/usketch-shared";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Canvas-scoped "interacting" state — true when user is dragging on the canvas.
 *
 * Listens to canvas:pointerdown / canvas:pointermove / canvas:pointerup events
 * via the EventBus, so only canvas interactions are detected (not scrollbar drags,
 * panel resizes, etc.).
 *
 * Event listeners are ref-counted: only one set of listeners exists regardless
 * of how many components call this hook. Cleanup only detaches listeners when
 * the last subscriber unmounts, preventing premature reset of global state.
 *
 * Also handles pointercancel and window blur to avoid stuck state.
 */

let interacting = false;
let pointerIsDown = false;
const storeListeners = new Set<() => void>();

function notify() {
	for (const fn of storeListeners) fn();
}

function setInteracting(value: boolean) {
	if (interacting === value) return;
	interacting = value;
	notify();
}

function getInteracting(): boolean {
	return interacting;
}

function subscribe(cb: () => void): () => void {
	storeListeners.add(cb);
	return () => storeListeners.delete(cb);
}

function reset() {
	pointerIsDown = false;
	setInteracting(false);
}

// ── Singleton event listener management ──

let refCount = 0;
let teardown: (() => void) | null = null;

function attach(events: EventBus) {
	refCount++;
	if (refCount > 1) return; // already attached

	const offDown = events.on("canvas:pointerdown", () => {
		pointerIsDown = true;
	});

	const offMove = events.on("canvas:pointermove", () => {
		if (pointerIsDown && !interacting) {
			setInteracting(true);
		}
	});

	const offUp = events.on("canvas:pointerup", () => {
		reset();
	});

	function onPointerCancel() {
		reset();
	}
	function onBlur() {
		reset();
	}

	window.addEventListener("pointercancel", onPointerCancel, true);
	window.addEventListener("blur", onBlur);
	document.addEventListener("visibilitychange", onBlur);

	teardown = () => {
		offDown();
		offMove();
		offUp();
		window.removeEventListener("pointercancel", onPointerCancel, true);
		window.removeEventListener("blur", onBlur);
		document.removeEventListener("visibilitychange", onBlur);
		reset();
		teardown = null;
	};
}

function detach() {
	refCount--;
	if (refCount > 0) return; // still has subscribers
	teardown?.();
}

/**
 * Returns `true` when the user is currently dragging on the canvas.
 * @param events - The app EventBus to listen for canvas pointer events.
 */
export function useInteracting(events: EventBus): boolean {
	useEffect(() => {
		attach(events);
		return () => detach();
	}, [events]);

	return useSyncExternalStore(subscribe, getInteracting, getInteracting);
}
