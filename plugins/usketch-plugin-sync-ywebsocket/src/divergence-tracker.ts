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
	let serverSynced = false;

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
	function onDocUpdate(_update: Uint8Array, origin: unknown): void {
		if (serverSynced) return;
		if (origin !== "remote") return;
		serverSynced = true;
		status.batch(() => {
			status.markFirstServerSyncObserved();
			// Bump state to "synced" if the socket was in "syncing".
			if (currentWsStatus === "connected") {
				status.update({ state: "synced" });
			}
		});
	}
	doc.on("update", onDocUpdate);

	function destroy() {
		offStatus();
		offMutation();
		shapesMap.unobserve(observer);
		doc.off("update", onDocUpdate);
	}

	return { status, destroy };
}
