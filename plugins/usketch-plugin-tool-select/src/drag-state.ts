let movingSelection = false;
const listeners: Set<() => void> = new Set();

function notify() {
	for (const fn of listeners) fn();
}

export function setMovingSelection(value: boolean): void {
	if (movingSelection === value) return;
	movingSelection = value;
	notify();
}

export function getMovingSelection(): boolean {
	return movingSelection;
}

export function subscribeMovingSelection(cb: () => void): () => void {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

export function clearMovingSelectionListeners(): void {
	listeners.clear();
}
