/** State for group editing mode (double-click to enter, click outside to exit) */

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
