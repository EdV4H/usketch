// A tiny observable holding the cell the dragged item will land in (world rect),
// or null when nothing is being dragged. The runtime publishes it during a drag;
// the grid overlay subscribes and highlights it — so there's a clear "drops here"
// placeholder even when the item is over empty space (where siblings don't move,
// so there'd otherwise be no visual feedback). Framework-free so both the .ts
// runtime and the .tsx overlay can share it.

export interface DragTargetRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

let target: DragTargetRect | null = null;
const listeners = new Set<() => void>();

/** Set (or clear, with null) the highlighted drop-target cell. */
export function setDragTarget(rect: DragTargetRect | null): void {
	// Avoid redundant notifications when nothing changed (both null, or same rect).
	if (rect === null && target === null) return;
	if (
		rect &&
		target &&
		rect.x === target.x &&
		rect.y === target.y &&
		rect.width === target.width &&
		rect.height === target.height
	) {
		return;
	}
	target = rect;
	for (const fn of listeners) fn();
}

export function getDragTarget(): DragTargetRect | null {
	return target;
}

export function subscribeDragTarget(cb: () => void): () => void {
	listeners.add(cb);
	return () => listeners.delete(cb);
}
