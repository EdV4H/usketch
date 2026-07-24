/**
 * Reactive store for board meta (title / cloud-or-local / id), shown in the
 * Control HUD via the board-meta panel plugin. The app feeds it with `set()`;
 * the panel subscribes. Module-scoped so it exists before plugin setup, and it
 * replaces the old `globalThis.__usketchBoardMeta` hand-off (no global).
 */
export type BoardMetaValue = { id?: string; name: string | null; isCloud: boolean };

export interface BoardMetaStore {
	getSnapshot(): BoardMetaValue;
	set(next: BoardMetaValue): void;
	subscribe(listener: () => void): () => void;
}

export const boardMetaStore: BoardMetaStore = (() => {
	let snapshot: BoardMetaValue = { name: null, isCloud: false };
	const listeners = new Set<() => void>();
	return {
		getSnapshot: () => snapshot,
		set(next: BoardMetaValue) {
			if (
				snapshot.id === next.id &&
				snapshot.name === next.name &&
				snapshot.isCloud === next.isCloud
			) {
				return;
			}
			snapshot = next;
			for (const l of listeners) l();
		},
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
})();
