/** State for hover indicator (shape under cursor) */

let hoveredShapeId: string | null = null;
const listeners = new Set<() => void>();

export function getHoveredShapeId(): string | null {
	return hoveredShapeId;
}

export function setHoveredShapeId(id: string | null): void {
	if (hoveredShapeId === id) return;
	hoveredShapeId = id;
	for (const listener of listeners) {
		listener();
	}
}

export function subscribeHoveredShape(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function clearHoveredShapeListeners(): void {
	listeners.clear();
	hoveredShapeId = null;
}
