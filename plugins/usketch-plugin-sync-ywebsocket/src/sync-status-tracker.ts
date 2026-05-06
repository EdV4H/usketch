export type SyncState = "loading" | "connecting" | "synced" | "syncing" | "disconnected" | "error";

export interface SyncStatusSnapshot {
	state: SyncState;
	shapeCount: number;
	/**
	 * Timestamp of the most recent activity that touched the snapshot — local
	 * mutations and server syncs alike. Useful for "last activity" displays
	 * but NOT a reliable indicator that the server has acknowledged anything.
	 * For divergence gating use `firstServerSyncAt` instead.
	 */
	lastSyncedAt: number | null;
	/**
	 * Timestamp of the first successful `setConfirmedFromServer(...)` call
	 * (i.e. the first `provider.on("sync", true)` event). Stays `null` until
	 * the server has actually merged its state with us. Set once and never
	 * cleared: a later disconnection should still allow consumers to surface
	 * divergence (offline edits accumulate exactly when the user needs the
	 * warning).
	 */
	firstServerSyncAt: number | null;
	error: string | null;
	/**
	 * Shape IDs present in the local Y.Doc that the server has NOT confirmed.
	 *
	 * Populated by `noteShapeAdded(id, "local")` (a shape created locally that
	 * hasn't been seen by the server yet) and by `noteShapesLoaded(...)` for
	 * pre-connection IndexedDB restoration. Becomes accurate only **after** the
	 * first `setConfirmedFromServer(...)` (`sync` event with `isSynced: true`):
	 * before that, every shape from a persisted Y.Doc looks "local-only" because
	 * we genuinely don't know what the server holds yet.
	 *
	 * Consumers should gate divergence UI on `firstServerSyncAt !== null` so
	 * the warning isn't surfaced during the initial `loading` / `connecting`
	 * phase (every cold start would otherwise look full of "unconfirmed"
	 * shapes). Once that first server sync has happened, the gate stays open
	 * even across later disconnections.
	 */
	unconfirmedShapeIds: readonly string[];
}

export class SyncStatusTracker {
	private snapshot: SyncStatusSnapshot = {
		state: "loading",
		shapeCount: 0,
		lastSyncedAt: null,
		firstServerSyncAt: null,
		error: null,
		unconfirmedShapeIds: [],
	};
	private listeners = new Set<() => void>();
	// Local sources of truth for divergence calculation. Kept private so callers
	// can only mutate via the dedicated methods below.
	private readonly shapeIds = new Set<string>();
	private readonly confirmedShapeIds = new Set<string>();
	// Batch mode: while > 0, mutators skip notification and a single notify is
	// fired when the batch closes. Used by yws-sync to combine `noteShapeAdded`
	// + `update({ shapeCount, lastSyncedAt })` into one render per mutation.
	private batchDepth = 0;
	private batchDirty = false;

	getSnapshot(): SyncStatusSnapshot {
		return this.snapshot;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Update the "free-form" snapshot fields (state / shapeCount / lastSyncedAt
	 * / error). The divergence-tracking fields (`unconfirmedShapeIds` and
	 * `firstServerSyncAt`) are intentionally excluded so callers can't bypass
	 * the dedicated APIs and break the invariant that `firstServerSyncAt` is
	 * stamped exactly once on the first server sync.
	 *
	 * @internal
	 */
	update(
		partial: Partial<Omit<SyncStatusSnapshot, "unconfirmedShapeIds" | "firstServerSyncAt">>,
	): void {
		this.snapshot = { ...this.snapshot, ...partial };
		this.notify();
	}

	/**
	 * Replace the "server-confirmed" set with the given IDs. Call this from the
	 * provider's `sync` event when `isSynced === true` — at that point the
	 * Y.Map state is the merged result of (server state ∪ what we uploaded),
	 * so every key currently in the map IS confirmed. Any local-only shape
	 * created later will diverge until the next sync event.
	 *
	 * Also stamps `firstServerSyncAt` on the first call so consumers can gate
	 * divergence UI on "have we ever heard back from the server?".
	 */
	setConfirmedFromServer(ids: Iterable<string>): void {
		this.confirmedShapeIds.clear();
		for (const id of ids) this.confirmedShapeIds.add(id);
		// Ensure shapeIds is a superset (ids that exist server-side must exist
		// locally too — they were just merged into our doc).
		for (const id of this.confirmedShapeIds) this.shapeIds.add(id);
		if (this.snapshot.firstServerSyncAt === null) {
			this.snapshot = { ...this.snapshot, firstServerSyncAt: Date.now() };
		}
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

	/**
	 * Bulk variant of `noteShapeAdded` for initial load. Avoids the O(n²)
	 * cost of calling the single-shape mutator in a loop (each call would
	 * re-scan `shapeIds` and notify subscribers). Recompute and notify
	 * happen once after all IDs are ingested.
	 */
	noteShapesLoaded(ids: Iterable<string>, source: "local" | "remote"): void {
		for (const id of ids) {
			this.shapeIds.add(id);
			if (source === "remote") {
				this.confirmedShapeIds.add(id);
			}
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

	/**
	 * Combine multiple mutator calls into a single notification. Useful when
	 * the caller wants to e.g. `noteShapeAdded(...)` and `update({ shapeCount })`
	 * back-to-back without paying for two re-renders.
	 *
	 * Re-entrant: nested calls are tolerated, the listeners fire once when the
	 * outermost batch closes.
	 */
	batch<T>(fn: () => T): T {
		this.batchDepth++;
		try {
			return fn();
		} finally {
			this.batchDepth--;
			if (this.batchDepth === 0 && this.batchDirty) {
				this.batchDirty = false;
				this.notify();
			}
		}
	}

	private notify(): void {
		if (this.batchDepth > 0) {
			this.batchDirty = true;
			return;
		}
		for (const listener of this.listeners) listener();
	}
}
