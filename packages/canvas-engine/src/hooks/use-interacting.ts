import type { EventBus } from "@edv4h/usketch-shared";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Canvas-scoped "interacting" state — true when user is dragging on the canvas.
 *
 * Listens to canvas:pointerdown / canvas:pointermove / canvas:pointerup events
 * via the EventBus, so only canvas interactions are detected (not scrollbar drags,
 * panel resizes, etc.).
 *
 * Event listeners are ref-counted per EventBus instance: multiple components
 * sharing the same EventBus reuse one set of listeners. Cleanup only detaches
 * listeners when the last subscriber for that EventBus unmounts.
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

// ── Per-EventBus ref-counted listener management ──

interface BusEntry {
	refCount: number;
	teardown: () => void;
}

const busMap = new WeakMap<EventBus, BusEntry>();

function attach(events: EventBus) {
	const existing = busMap.get(events);
	if (existing) {
		existing.refCount++;
		return;
	}

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

	busMap.set(events, {
		refCount: 1,
		teardown: () => {
			offDown();
			offMove();
			offUp();
			window.removeEventListener("pointercancel", onPointerCancel, true);
			window.removeEventListener("blur", onBlur);
			document.removeEventListener("visibilitychange", onBlur);
			reset();
		},
	});
}

function detach(events: EventBus) {
	const entry = busMap.get(events);
	if (!entry) return;
	entry.refCount--;
	if (entry.refCount > 0) return;
	entry.teardown();
	busMap.delete(events);
}

/**
 * Side-effect-only hook that ensures interacting-state event listeners
 * are attached to the given EventBus. Does NOT subscribe to the store,
 * so calling this does not cause re-renders when `interacting` changes.
 *
 * Use this in components (like Canvas) that only need to keep listeners
 * alive without reading the interacting value.
 */
export function useInteractingListeners(events: EventBus): void {
	useEffect(() => {
		attach(events);
		return () => detach(events);
	}, [events]);
}

/**
 * Returns `true` when the user is currently dragging on the canvas.
 * Also ensures listeners are attached (ref-counted).
 * @param events - The app EventBus to listen for canvas pointer events.
 */
export function useInteracting(events: EventBus): boolean {
	useEffect(() => {
		attach(events);
		return () => detach(events);
	}, [events]);

	return useSyncExternalStore(subscribe, getInteracting, getInteracting);
}
