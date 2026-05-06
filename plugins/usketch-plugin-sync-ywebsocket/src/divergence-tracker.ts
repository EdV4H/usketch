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
}

export interface DivergenceTrackerHandle {
	status: SyncStatusTracker;
	destroy: () => void;
}

export function createDivergenceTracker(opts: DivergenceTrackerOptions): DivergenceTrackerHandle {
	const { store, doc, shapesMap, onConnectionStatusChange } = opts;
	const status = new SyncStatusTracker();

	let currentWsStatus = "disconnected";

	// 1. Connection state — drives the "is local add already confirmed?" decision
	//    in the store mutation handler below.
	const offStatus = onConnectionStatusChange((next) => {
		currentWsStatus = next;
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

	// 5. First remote-origin doc update marks the server as "synced with us"
	//    once and for all. After that, every key currently in the map is
	//    treated as confirmed (we wouldn't have it locally otherwise — the
	//    merged state is the union we just received).
	let serverSynced = false;
	function onDocUpdate(_update: Uint8Array, origin: unknown): void {
		if (serverSynced) return;
		if (origin !== "remote") return;
		serverSynced = true;
		const ids: string[] = [];
		for (const id of shapesMap.keys()) ids.push(id);
		status.setConfirmedFromServer(ids);
	}
	doc.on("update", onDocUpdate);

	// 6. As shapes propagate from Y.Map → store, the existing `addShape` /
	//    `deleteShape` calls in the consumer's IDB sync pipeline will fire
	//    `store.onMutation` events. We don't want those to be re-noted as
	//    "local" — but the store mutation handler above can't tell IDB-driven
	//    mutations apart from user-driven ones. The `transaction.local` check
	//    in the Y.Map observer means we only `noteShapeAdded("remote", ...)`
	//    for genuinely remote ones, and the store mutation will see the same
	//    id already in `shapeIds` so it's effectively a no-op (Set.add is
	//    idempotent). Confirm preservation is also idempotent.

	function destroy() {
		offStatus();
		offMutation();
		shapesMap.unobserve(observer);
		doc.off("update", onDocUpdate);
	}

	return { status, destroy };
}
