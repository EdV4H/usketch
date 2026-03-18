export type SyncState = "loading" | "synced" | "syncing" | "error";

export interface SyncStatusSnapshot {
	state: SyncState;
	/** Number of shapes persisted in Y.Doc */
	shapeCount: number;
	/** Timestamp of last successful sync to IndexedDB */
	lastSyncedAt: number | null;
	/** Error message if state is "error" */
	error: string | null;
}

export class SyncStatusTracker {
	private snapshot: SyncStatusSnapshot = {
		state: "loading",
		shapeCount: 0,
		lastSyncedAt: null,
		error: null,
	};
	private listeners = new Set<() => void>();

	getSnapshot(): SyncStatusSnapshot {
		return this.snapshot;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/** @internal */
	update(partial: Partial<SyncStatusSnapshot>): void {
		this.snapshot = { ...this.snapshot, ...partial };
		for (const listener of this.listeners) {
			listener();
		}
	}
}
