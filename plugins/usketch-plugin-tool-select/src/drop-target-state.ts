/** State for drop target indicator (frame under dragged shape) */

let dropTargetId: string | null = null;
const listeners = new Set<() => void>();

export function getDropTargetId(): string | null {
	return dropTargetId;
}

export function setDropTargetId(id: string | null): void {
	if (dropTargetId === id) return;
	dropTargetId = id;
	for (const listener of listeners) {
		listener();
	}
}

export function subscribeDropTarget(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function clearDropTargetListeners(): void {
	listeners.clear();
	dropTargetId = null;
}
