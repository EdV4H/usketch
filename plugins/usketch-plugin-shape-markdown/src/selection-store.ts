/**
 * Tiny observable of "which markdown shapes are currently selected", shared
 * between the plugin (writer, from `store.subscribe`) and the view renderer
 * (reader, via `useSyncExternalStore`).
 *
 * The view uses this to make rendered content interactive (links / checkboxes)
 * only while the shape is selected — unselected shapes stay `pointerEvents:none`
 * so a click selects/moves the shape on the canvas.
 */
let selectedIds: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

export const markdownSelection = {
	/** Replace the selected-id set and notify subscribers (no-op if unchanged). */
	set(ids: ReadonlySet<string>): void {
		if (sameSet(ids, selectedIds)) return;
		selectedIds = new Set(ids);
		for (const l of listeners) l();
	},
	has(id: string): boolean {
		return selectedIds.has(id);
	},
	subscribe(listener: () => void): () => void {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
};

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
	if (a.size !== b.size) return false;
	for (const v of a) if (!b.has(v)) return false;
	return true;
}
