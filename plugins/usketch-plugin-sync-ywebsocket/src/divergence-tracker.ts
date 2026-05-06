import type { BoardStore } from "@edv4h/usketch-shared";
import type * as Y from "yjs";
import { SyncStatusTracker } from "./sync-status-tracker.js";

/**
 * Standalone divergence tracker for apps that wire IDB sync + WsProvider
 * **manually** (rather than via `createYwebsocketSyncPlugin`). It watches the
 * store, the Y.Map of shapes, and the WebSocket connection, then exposes a
 * `SyncStatusTracker` whose `unconfirmedShapeIds` reflects shapes that exist
 * locally but the server hasn't acknowledged.
 *
 * Why this exists: the full plugin embeds y-websocket's `provider.on("sync")`
 * event for the "first server sync" stamp, but `@edv4h/usketch-sync`'s
 * `createWsProvider` doesn't expose that signal. We approximate by stamping
 * `firstServerSyncAt` on the first remote-origin Y.Doc update, which is the
 * earliest moment we can be sure the server has talked back to us.
 */
export interface DivergenceTrackerOptions {
	store: BoardStore;
	doc: Y.Doc;
	shapesMap: Y.Map<Record<string, unknown>>;
	/** Subscribe to socket-level connection state (`"connected"` / `"connecting"` / `"disconnected"`). */
	onConnectionStatusChange: (handler: (status: string) => void) => () => void;
	/**
	 * Grace period (ms) to wait after the socket reaches `"connected"` before
	 * concluding "first sync completed" if no remote Y.Doc update has arrived.
	 * The y-websocket SYNC_STEP1/STEP2 round-trip is normally fast, so even an
	 * empty server (no shapes to push) will resolve well under a second. We
	 * pick a generous default to avoid false positives on slow networks.
	 *
	 * Defaults to 2000ms. Set to 0 to disable the timer-based fallback (only
	 * the first remote update will stamp).
	 */
	emptyServerGraceMs?: number;
}

export interface DivergenceTrackerHandle {
	status: SyncStatusTracker;
	destroy: () => void;
}

export function createDivergenceTracker(opts: DivergenceTrackerOptions): DivergenceTrackerHandle {
	const { store, doc, shapesMap, onConnectionStatusChange, emptyServerGraceMs = 2000 } = opts;
	const status = new SyncStatusTracker();

	let currentWsStatus = "disconnected";
	let serverSynced = false;
	// Timer that fires `markServerSynced()` if `connected` persists for
	// `emptyServerGraceMs` without any remote Y.Doc update. Covers the
	// "empty server / no history" case where a remote update never comes.
	let emptyServerTimer: ReturnType<typeof setTimeout> | null = null;

	function clearEmptyServerTimer(): void {
		if (emptyServerTimer !== null) {
			clearTimeout(emptyServerTimer);
			emptyServerTimer = null;
		}
	}

	function markServerSynced(): void {
		if (serverSynced) return;
		serverSynced = true;
		clearEmptyServerTimer();
		status.batch(() => {
			status.markFirstServerSyncObserved();
			if (currentWsStatus === "connected") {
				status.update({ state: "synced" });
			}
		});
	}

	// 1. Connection state — drives the "is local add already confirmed?" decision
	//    in the store mutation handler below, and is mirrored onto the snapshot
	//    `state` field so consumers (e.g. Debug HUD's Persistence indicator)
	//    show the right thing.
	const offStatus = onConnectionStatusChange((next) => {
		currentWsStatus = next;
		// Mirror transport state into the snapshot using the same mapping the
		// full ywebsocket plugin uses: socket-level "connected" maps to
		// "syncing" until the first remote update arrives, then "synced".
		const mappedState =
			next === "connected"
				? serverSynced
					? "synced"
					: "syncing"
				: next === "connecting"
					? "connecting"
					: next === "disconnected"
						? "disconnected"
						: "error";
		status.update({
			state: mappedState,
			error: next === "failed" ? "connection failed" : null,
		});

		// Empty-server fallback: when we connect but the server has nothing to
		// push (new room, lost history), `doc.on("update")` never fires. Start
		// a timer so `firstServerSyncAt` is still stamped after the SYNC round-
		// trip has had time to complete. `emptyServerGraceMs: 0` opts out.
		if (next === "connected" && !serverSynced && emptyServerGraceMs > 0) {
			clearEmptyServerTimer();
			emptyServerTimer = setTimeout(markServerSynced, emptyServerGraceMs);
		} else if (next !== "connected") {
			// Drop the timer if we got disconnected before the grace expired.
			clearEmptyServerTimer();
		}
	});

	// 2. Initial load: every shape already in the Y.Map (typically restored from
	//    IndexedDB) is "local-only" until the server confirms.
	if (shapesMap.size > 0) {
		const initialIds: string[] = [];
		for (const id of shapesMap.keys()) initialIds.push(id);
		status.noteShapesLoaded(initialIds, "local");
	}

	// 3. Local mutations from the store — online → confirmed (broadcast goes
	//    out immediately), offline → unconfirmed.
	const offMutation = store.onMutation((event) => {
		const payload = event.payload as { id?: string } | undefined;
		if (!payload?.id) return;
		status.batch(() => {
			if (event.type === "shape:added") {
				const isOnline = currentWsStatus === "connected";
				status.noteShapeAdded(payload.id as string, isOnline ? "remote" : "local");
			} else if (event.type === "shape:removed") {
				status.noteShapeRemoved(payload.id as string);
			}
			status.update({ shapeCount: shapesMap.size, lastSyncedAt: Date.now() });
		});
	});

	// 4. Y.Map observe — for remote-origin additions (server pushed a shape
	//    we didn't have, or another peer added one).
	const observer = (events: Y.YMapEvent<Record<string, unknown>>): void => {
		const isLocalTxn = events.transaction.local;
		status.batch(() => {
			for (const [key, change] of events.changes.keys) {
				if (change.action === "add" && !isLocalTxn) {
					// Remote add → confirmed by server.
					status.noteShapeAdded(key, "remote");
				} else if (change.action === "delete") {
					status.noteShapeRemoved(key);
				}
			}
			status.update({ shapeCount: shapesMap.size, lastSyncedAt: Date.now() });
		});
	};
	shapesMap.observe(observer);

	// 5. First remote-origin doc update marks the server as "synced with us".
	//    We deliberately DO NOT bulk-confirm `shapesMap.keys()` here — that
	//    would silently mark every IndexedDB-restored shape as "the server
	//    knows about it", which is exactly what we want to NOT assume (the
	//    whole point of this overlay is to surface phantom/orphaned shapes).
	//    Instead, the Y.Map observer above marks individual remote-origin
	//    additions as confirmed via `noteShapeAdded(key, "remote")`. Anything
	//    the server didn't push to us during this session stays unconfirmed.
	//
	//    Note: an "empty" server sync (no shapes to push) won't trigger this
	//    handler — the `emptyServerTimer` started above is the fallback that
	//    catches that case.
	function onDocUpdate(_update: Uint8Array, origin: unknown): void {
		if (origin !== "remote") return;
		markServerSynced();
	}
	doc.on("update", onDocUpdate);

	function destroy() {
		clearEmptyServerTimer();
		offStatus();
		offMutation();
		shapesMap.unobserve(observer);
		doc.off("update", onDocUpdate);
	}

	return { status, destroy };
}
