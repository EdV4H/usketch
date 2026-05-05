export type SyncState = "loading" | "connecting" | "synced" | "syncing" | "disconnected" | "error";

export interface SyncStatusSnapshot {
	state: SyncState;
	shapeCount: number;
	lastSyncedAt: number | null;
	error: string | null;
	/**
	 * Shape IDs present in the local Y.Doc that the server has NOT confirmed.
	 *
	 * Populated by `noteShapeAdded("local", id)` (a shape created locally that
	 * hasn't been seen by the server yet) or by being absent from the snapshot
	 * `setConfirmedFromServer(...)` recorded at the most recent `sync` event.
	 *
	 * Empty until the first server sync; clients should only show divergence UI
	 * once `state === "synced"` has been observed at least once.
	 */
	unconfirmedShapeIds: readonly string[];
}

export class SyncStatusTracker {
	private snapshot: SyncStatusSnapshot = {
		state: "loading",
		shapeCount: 0,
		lastSyncedAt: null,
		error: null,
		unconfirmedShapeIds: [],
	};
	private listeners = new Set<() => void>();
	// Local sources of truth for divergence calculation. Kept private so callers
	// can only mutate via the dedicated methods below.
	private readonly shapeIds = new Set<string>();
	private readonly confirmedShapeIds = new Set<string>();

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
	update(partial: Partial<Omit<SyncStatusSnapshot, "unconfirmedShapeIds">>): void {
		this.snapshot = { ...this.snapshot, ...partial };
		this.notify();
	}

	/**
	 * Replace the "server-confirmed" set with the given IDs. Call this from the
	 * provider's `sync` event when `isSynced === true` — at that point the
	 * Y.Map state is the merged result of (server state ∪ what we uploaded),
	 * so every key currently in the map IS confirmed. Any local-only shape
	 * created later will diverge until the next sync event.
	 */
	setConfirmedFromServer(ids: Iterable<string>): void {
		this.confirmedShapeIds.clear();
		for (const id of ids) this.confirmedShapeIds.add(id);
		// Ensure shapeIds is a superset (ids that exist server-side must exist
		// locally too — they were just merged into our doc).
		for (const id of this.confirmedShapeIds) this.shapeIds.add(id);
		this.recompute();
	}

	/**
	 * Note a shape addition. `source = "remote"` means the shape arrived via the
	 * Yjs provider (server origin), so it's already confirmed. `source = "local"`
	 * means we created it client-side and the server has yet to acknowledge.
	 */
	noteShapeAdded(id: string, source: "local" | "remote"): void {
		this.shapeIds.add(id);
		if (source === "remote") {
			this.confirmedShapeIds.add(id);
		}
		this.recompute();
	}

	noteShapeRemoved(id: string): void {
		this.shapeIds.delete(id);
		this.confirmedShapeIds.delete(id);
		this.recompute();
	}

	private recompute(): void {
		const unconfirmed: string[] = [];
		for (const id of this.shapeIds) {
			if (!this.confirmedShapeIds.has(id)) unconfirmed.push(id);
		}
		this.snapshot = {
			...this.snapshot,
			shapeCount: this.shapeIds.size,
			unconfirmedShapeIds: unconfirmed,
		};
		this.notify();
	}

	private notify(): void {
		for (const listener of this.listeners) listener();
	}
}
