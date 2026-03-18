let dragging = false;
const listeners: Set<() => void> = new Set();

function notify() {
	for (const fn of listeners) fn();
}

export function setDragging(value: boolean): void {
	if (dragging === value) return;
	dragging = value;
	notify();
}

export function getDragging(): boolean {
	return dragging;
}

export function subscribeDragging(cb: () => void): () => void {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

export function clearDraggingListeners(): void {
	listeners.clear();
}
