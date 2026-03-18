/**
 * Structural types matching SyncStatusTracker from @edv4h/usketch-store.
 * Defined locally to avoid adding a dependency on the store package.
 */

export type SyncState = "loading" | "synced" | "syncing" | "error";

export interface SyncStatusSnapshot {
	state: SyncState;
	shapeCount: number;
	lastSyncedAt: number | null;
	error: string | null;
}

export interface SyncStatusTrackerLike {
	getSnapshot(): SyncStatusSnapshot;
	subscribe(listener: () => void): () => void;
}
