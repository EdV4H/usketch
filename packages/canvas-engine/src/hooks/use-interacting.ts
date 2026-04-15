import type { EventBus } from "@edv4h/usketch-shared";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Canvas-scoped "interacting" state — true when user is dragging on the canvas.
 *
 * Listens to canvas:pointerdown / canvas:pointermove / canvas:pointerup events
 * via the EventBus, so only canvas interactions are detected (not scrollbar drags,
 * panel resizes, etc.).
 *
 * Also handles pointercancel and window blur to avoid stuck state.
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

function reset() {
	pointerIsDown = false;
	setInteracting(false);
}

/**
 * Returns `true` when the user is currently dragging on the canvas.
 * @param events - The app EventBus to listen for canvas pointer events.
 */
export function useInteracting(events: EventBus): boolean {
	useEffect(() => {
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

		// Safety: reset on pointercancel / window blur / visibility change
		function onPointerCancel() {
			reset();
		}
		function onBlur() {
			reset();
		}

		window.addEventListener("pointercancel", onPointerCancel, true);
		window.addEventListener("blur", onBlur);
		document.addEventListener("visibilitychange", onBlur);

		return () => {
			offDown();
			offMove();
			offUp();
			window.removeEventListener("pointercancel", onPointerCancel, true);
			window.removeEventListener("blur", onBlur);
			document.removeEventListener("visibilitychange", onBlur);
			reset();
		};
	}, [events]);

	return useSyncExternalStore(subscribe, getInteracting, getInteracting);
}
