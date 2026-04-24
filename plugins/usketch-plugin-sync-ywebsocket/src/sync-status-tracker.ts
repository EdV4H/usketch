export type SyncState = "loading" | "connecting" | "synced" | "syncing" | "disconnected" | "error";

export interface SyncStatusSnapshot {
	state: SyncState;
	shapeCount: number;
	lastSyncedAt: number | null;
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
