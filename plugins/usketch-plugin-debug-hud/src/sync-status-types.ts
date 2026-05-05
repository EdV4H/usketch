/**
 * Structural types matching SyncStatusTracker from @edv4h/usketch-store
 * and @edv4h/usketch-plugin-sync-ywebsocket. Defined locally to avoid taking
 * a runtime dependency on either package.
 *
 * `unconfirmedShapeIds` is contributed by the ywebsocket tracker only —
 * IndexedDB-only trackers leave it empty.
 */

export type SyncState = "loading" | "connecting" | "synced" | "syncing" | "disconnected" | "error";

export interface SyncStatusSnapshot {
	state: SyncState;
	shapeCount: number;
	lastSyncedAt: number | null;
	error: string | null;
	unconfirmedShapeIds?: readonly string[];
}

export interface SyncStatusTrackerLike {
	getSnapshot(): SyncStatusSnapshot;
	subscribe(listener: () => void): () => void;
}
