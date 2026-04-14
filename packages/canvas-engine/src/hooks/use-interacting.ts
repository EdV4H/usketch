import { useEffect, useSyncExternalStore } from "react";

/**
 * Global "interacting" state — true when user is dragging (pointerdown + pointermove).
 *
 * Used by ShapeAnchorOverlay to hide toolbars during drag operations.
 * Purely DOM-level detection, no dependency on specific tools or plugins.
 */

let interacting = false;
let pointerIsDown = false;
const listeners = new Set<() => void>();

function notify() {
	for (const fn of listeners) fn();
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
	listeners.add(cb);
	return () => listeners.delete(cb);
}

// Single global listener setup (shared across all hook instances)
let listenerCount = 0;

function onPointerDown() {
	pointerIsDown = true;
}

function onPointerMove() {
	if (pointerIsDown && !interacting) {
		setInteracting(true);
	}
}

function onPointerUp() {
	pointerIsDown = false;
	if (interacting) {
		setInteracting(false);
	}
}

function addGlobalListeners() {
	window.addEventListener("pointerdown", onPointerDown, true);
	window.addEventListener("pointermove", onPointerMove, true);
	window.addEventListener("pointerup", onPointerUp, true);
}

function removeGlobalListeners() {
	window.removeEventListener("pointerdown", onPointerDown, true);
	window.removeEventListener("pointermove", onPointerMove, true);
	window.removeEventListener("pointerup", onPointerUp, true);
	pointerIsDown = false;
	setInteracting(false);
}

/**
 * Returns `true` when the user is currently dragging (pointerdown + pointermove).
 * Automatically manages global pointer listeners.
 */
export function useInteracting(): boolean {
	useEffect(() => {
		listenerCount++;
		if (listenerCount === 1) addGlobalListeners();
		return () => {
			listenerCount--;
			if (listenerCount === 0) removeGlobalListeners();
		};
	}, []);

	return useSyncExternalStore(subscribe, getInteracting, getInteracting);
}
