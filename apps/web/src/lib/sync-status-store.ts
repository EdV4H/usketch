/**
 * Stable reactive facade over the current sync-status tracker, shown in the
 * Control HUD via the sync-status panel plugin. Unlike board-meta/presence, the
 * underlying tracker is created per-board and swapped (base IndexedDB → cloud
 * divergence), so this store holds a *swappable* inner tracker and forwards its
 * notifications. Replaces the old `globalThis.__usketchSyncStatus` hand-off.
 */

export type SyncState = "loading" | "connecting" | "synced" | "syncing" | "disconnected" | "error";

export interface SyncStatusSnapshot {
	state: SyncState;
	shapeCount: number;
	lastSyncedAt: number | null;
	/**
	 * Timestamp of the first successful server sync, or null before the client
	 * has heard back. Gate divergence UI on this (not `lastSyncedAt`, which also
	 * moves on local edits).
	 */
	firstServerSyncAt?: number | null;
	error: string | null;
	unconfirmedShapeIds?: readonly string[];
}

/** Structural shape of a sync tracker (getSnapshot/subscribe). */
export interface SyncStatusTrackerLike {
	getSnapshot(): SyncStatusSnapshot;
	subscribe(listener: () => void): () => void;
}

export const DEFAULT_SYNC_SNAPSHOT: SyncStatusSnapshot = {
	state: "loading",
	shapeCount: 0,
	lastSyncedAt: null,
	firstServerSyncAt: null,
	error: null,
	unconfirmedShapeIds: [],
};

export interface SyncStatusStore extends SyncStatusTrackerLike {
	/** Point the store at the current tracker (or `null` on teardown). */
	setTracker(tracker: SyncStatusTrackerLike | null): void;
}

export const syncStatusStore: SyncStatusStore = (() => {
	let current: SyncStatusTrackerLike | null = null;
	let offInner: (() => void) | null = null;
	const listeners = new Set<() => void>();
	const notify = () => {
		for (const l of listeners) l();
	};
	return {
		setTracker(tracker: SyncStatusTrackerLike | null) {
			if (tracker === current) return;
			offInner?.();
			offInner = null;
			current = tracker;
			// Forward the new tracker's own updates to our subscribers.
			if (tracker) offInner = tracker.subscribe(notify);
			// Notify so subscribers re-read getSnapshot against the new tracker.
			notify();
		},
		// current's snapshot is referentially stable until the tracker updates;
		// DEFAULT_SYNC_SNAPSHOT is a module constant — safe for useSyncExternalStore.
		getSnapshot: () => current?.getSnapshot() ?? DEFAULT_SYNC_SNAPSHOT,
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
})();
