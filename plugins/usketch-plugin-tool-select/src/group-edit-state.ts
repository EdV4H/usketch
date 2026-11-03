/** State for group editing mode (double-click to enter, click outside to exit) */

import type { ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { isShapeContainer } from "@edv4h/usketch-shared";

/**
 * Whether double-clicking `shape` enters group editing mode on it: any shape
 * whose definition declares itself a container (`container`, see
 * {@link isShapeContainer}) — `group` and `frame` among the built-ins, plus
 * plugin containers such as `voice-frame`.
 */
export function canEnterGroupEdit(
	shapes: Pick<ShapeRegistry, "get">,
	shape: ShapeData | undefined,
): boolean {
	return !!shape && isShapeContainer(shapes.get(shape.type), shape);
}

let editingGroupId: string | null = null;
const listeners = new Set<() => void>();

export function getEditingGroupId(): string | null {
	return editingGroupId;
}

export function setEditingGroupId(id: string | null): void {
	if (editingGroupId === id) return;
	editingGroupId = id;
	for (const listener of listeners) {
		listener();
	}
}

export function subscribeEditingGroup(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function clearEditingGroupListeners(): void {
	listeners.clear();
	editingGroupId = null;
}
