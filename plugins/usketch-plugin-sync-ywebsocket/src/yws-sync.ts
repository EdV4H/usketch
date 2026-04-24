import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import type { WsConnectionStatus, WsProviderHandle } from "@edv4h/usketch-sync";
import { Awareness } from "y-protocols/awareness";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import { SyncStatusTracker } from "./sync-status-tracker.js";
import type { ResolveParamsContext, YwebsocketSyncHandle, YwebsocketSyncOptions } from "./types.js";

function toPlainObject(shape: ShapeData): Record<string, unknown> {
	return JSON.parse(JSON.stringify(shape));
}

type ProviderState = {
	provider: WebsocketProvider;
	unbind: () => void;
};

export function createYwebsocketSync(
	store: BoardStore,
	options: YwebsocketSyncOptions,
): YwebsocketSyncHandle {
	const {
		url,
		roomName,
		shapesMapKey = "shapes",
		resolveParams,
		onCloseCode,
		idleTimeoutMs = 0,
		autoConnect = true,
		doc: providedDoc,
		WebSocketPolyfill,
	} = options;

	const doc = providedDoc ?? new Y.Doc();
	const ownsDoc = providedDoc === undefined;
	const shapesMap = doc.getMap<Record<string, unknown>>(shapesMapKey);
	const status = new SyncStatusTracker();

	let destroyed = false;
	let isSyncing = false;
	let attempt = 0;
	let currentState: ProviderState | null = null;
	let lastCloseCode: number | undefined;
	let lastCloseReason: string | undefined;
	// `paused` is set by `disconnect()` and cleared by `resume()` / destroy, so an
	// in-flight `connect()` (mid-`await resolveParams`) bails out instead of
	// creating a socket after a user-initiated disconnect.
	let paused = false;
	// Generation counter to cancel stale async `connect()` runs. Each `connect()`
	// captures its generation and re-checks after every await boundary; any
	// disconnect/destroy increments the counter and invalidates pending runs.
	let connectGeneration = 0;

	// A long-lived Awareness bound to `doc`. Created up-front so `wsProvider.awareness`
	// is always valid (WsProviderHandle consumers, e.g. presence-cursor, destructure
	// it at plugin-creation time). The same instance is passed into every
	// WebsocketProvider so remote awareness updates keep flowing through reconnects.
	const sharedAwareness: Awareness = new Awareness(doc);

	// WsProviderHandle event listener sets — persist across reconnects.
	const statusListeners = new Set<(status: WsConnectionStatus) => void>();
	const broadcastListeners = new Set<(msg: Record<string, unknown>) => void>();

	function notifyStatus(next: WsConnectionStatus): void {
		// "connected" at the transport level only means the socket is open — the
		// first Yjs sync has not necessarily completed. Map to "syncing" until the
		// provider's `sync` event fires; `onSync` will flip the tracker to "synced".
		status.update({
			state:
				next === "connected"
					? "syncing"
					: next === "connecting"
						? "connecting"
						: next === "disconnected"
							? "disconnected"
							: "error",
			error: next === "failed" ? "connection failed" : null,
		});
		for (const listener of statusListeners) {
			listener(next);
		}
	}

	// ── Store ↔ Y.Doc binding ──────────────────────────────────────────────────
	// These observers are set up once; they keep working across provider reconnects
	// because they bind to `doc` / `shapesMap` rather than the provider.

	const unsubMutation = store.onMutation((event) => {
		if (isSyncing || destroyed) return;

		const payload = event.payload as { id: string } | undefined;
		if (!payload?.id) return;

		isSyncing = true;
		try {
			switch (event.type) {
				case "shape:added":
				case "shape:updated": {
					const shape = store.getShape(payload.id);
					if (shape) {
						shapesMap.set(payload.id, toPlainObject(shape));
					}
					break;
				}
				case "shape:removed": {
					shapesMap.delete(payload.id);
					break;
				}
			}
		} finally {
			isSyncing = false;
		}

		// Keep the status snapshot in sync with the authoritative Y.Map size so
		// consumers (DebugHUD etc.) see up-to-date counts after local edits too.
		status.update({ shapeCount: shapesMap.size, lastSyncedAt: Date.now() });
		resetIdleTimer();
	});

	const shapesObserver = (events: Y.YMapEvent<Record<string, unknown>>): void => {
		if (isSyncing || destroyed) return;

		isSyncing = true;
		try {
			for (const [key, change] of events.changes.keys) {
				switch (change.action) {
					case "add":
					case "update": {
						const value = shapesMap.get(key);
						if (value) {
							const shape = value as unknown as ShapeData;
							const existing = store.getShape(key);
							if (existing) {
								store.updateShape(key, shape);
							} else {
								store.addShape(shape);
							}
						}
						break;
					}
					case "delete": {
						if (store.getShape(key)) {
							store.deleteShape(key);
						}
						break;
					}
				}
			}
		} finally {
			isSyncing = false;
		}

		status.update({ shapeCount: shapesMap.size, lastSyncedAt: Date.now() });
	};

	shapesMap.observe(shapesObserver);

	// ── Initial load: existing Y.Doc → store (pre-connection, e.g. from a persisted doc) ──
	function applyInitialLoad(): void {
		if (shapesMap.size === 0) return;
		const idsNeedingZIndex: string[] = [];
		isSyncing = true;
		try {
			for (const [id, value] of shapesMap.entries()) {
				const shape = value as unknown as ShapeData;
				if (!store.getShape(id)) {
					store.addShape(shape);
				}
				// Track legacy shapes that were persisted before z-order was introduced.
				if (typeof shape.zIndex !== "string") {
					idsNeedingZIndex.push(id);
				}
			}
		} finally {
			isSyncing = false;
		}

		// Backfill zIndex into Y.Map for any shape that got an auto-assigned one,
		// so other clients observe the same stable z-order on subsequent loads.
		if (idsNeedingZIndex.length > 0) {
			doc.transact(() => {
				for (const id of idsNeedingZIndex) {
					const current = store.getShape(id);
					if (current) shapesMap.set(id, toPlainObject(current));
				}
			});
		}

		status.update({ shapeCount: shapesMap.size });
	}

	applyInitialLoad();

	// ── Idle timer ─────────────────────────────────────────────────────────────

	let idleTimer: ReturnType<typeof setTimeout> | null = null;

	function clearIdleTimer(): void {
		if (idleTimer) {
			clearTimeout(idleTimer);
			idleTimer = null;
		}
	}

	function resetIdleTimer(): void {
		if (idleTimeoutMs <= 0 || destroyed) return;
		clearIdleTimer();
		idleTimer = setTimeout(() => {
			disconnect({ reason: "idle" });
		}, idleTimeoutMs);
	}

	// ── Provider lifecycle ─────────────────────────────────────────────────────

	let whenSyncedResolve: (() => void) | null = null;
	const whenSynced = new Promise<void>((resolve) => {
		whenSyncedResolve = resolve;
	});
	let firstSyncSettled = false;

	function settleFirstSync(): void {
		if (firstSyncSettled) return;
		firstSyncSettled = true;
		whenSyncedResolve?.();
	}

	async function connect(): Promise<void> {
		if (destroyed || paused || currentState) return;
		const myGeneration = ++connectGeneration;

		status.update({ state: "connecting" });

		let connParams: Record<string, string> = {};
		if (resolveParams) {
			try {
				const ctx: ResolveParamsContext = {
					attempt,
					previousCloseCode: lastCloseCode,
					previousCloseReason: lastCloseReason,
				};
				const resolved = await resolveParams(ctx);
				// After await: bail out if disconnect/destroy happened or a newer
				// connect() superseded this run.
				if (destroyed || paused || myGeneration !== connectGeneration) return;
				connParams = resolved.params ?? {};
			} catch (err) {
				if (destroyed || paused || myGeneration !== connectGeneration) return;
				status.update({
					state: "error",
					error: err instanceof Error ? err.message : String(err),
				});
				// Unblock `whenSynced` so plugin setup can proceed — consumers should
				// inspect `status.getSnapshot()` to detect the persistent failure state.
				settleFirstSync();
				scheduleReconnect();
				return;
			}
		}

		if (destroyed || paused || myGeneration !== connectGeneration) return;

		const provider = new WebsocketProvider(url, roomName, doc, {
			connect: true,
			params: connParams,
			awareness: sharedAwareness,
			WebSocketPolyfill: WebSocketPolyfill as typeof WebSocket | undefined,
			resyncInterval: 0,
		});

		const onStatus = (event: { status: "connecting" | "connected" | "disconnected" }): void => {
			if (event.status === "connected") {
				attempt = 0;
				lastCloseCode = undefined;
				lastCloseReason = undefined;
				notifyStatus("connected");
				resetIdleTimer();
			} else if (event.status === "connecting") {
				notifyStatus("connecting");
			} else {
				notifyStatus("disconnected");
			}
		};

		const onSync = (isSynced: boolean): void => {
			if (isSynced) {
				status.update({
					state: "synced",
					shapeCount: shapesMap.size,
					lastSyncedAt: Date.now(),
				});
				settleFirstSync();
			}
		};

		const onConnectionClose = (event: CloseEvent | null): void => {
			const code = event?.code ?? 0;
			const reason = event?.reason ?? "";
			lastCloseCode = code;
			lastCloseReason = reason;

			const decision = onCloseCode?.(code, reason);
			if (decision === "stop") {
				tearDownProvider();
				notifyStatus("disconnected");
				settleFirstSync();
				return;
			}
			// "retry" or undefined → fall through to reconnect
			tearDownProvider();
			if (decision === "retry") {
				// Explicit retry reconnects immediately, so reset the backoff counter
				// (this also resets `ctx.attempt` — see ResolveParamsContext.attempt docstring).
				attempt = 0;
				void connect();
			} else {
				scheduleReconnect();
			}
		};

		const onConnectionError = (): void => {
			// y-websocket emits connection-error before close; we rely on close for reconnect.
		};

		provider.on("status", onStatus);
		provider.on("sync", onSync);
		provider.on("connection-close", onConnectionClose);
		provider.on("connection-error", onConnectionError);

		currentState = {
			provider,
			unbind: () => {
				provider.off("status", onStatus);
				provider.off("sync", onSync);
				provider.off("connection-close", onConnectionClose);
				provider.off("connection-error", onConnectionError);
			},
		};
	}

	function tearDownProvider(): void {
		if (!currentState) return;
		currentState.unbind();
		try {
			currentState.provider.disconnect();
		} catch {
			// ignore
		}
		try {
			// `destroy` cleans up the socket but keeps the awareness instance that we've
			// captured. We reattach to a fresh one on reconnect via `sharedAwareness`.
			currentState.provider.destroy();
		} catch {
			// ignore
		}
		currentState = null;
	}

	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	function scheduleReconnect(): void {
		if (destroyed) return;
		if (reconnectTimer) return;
		attempt += 1;
		// Exponential backoff with jitter, cap 30s
		const base = Math.min(1000 * 2 ** Math.min(attempt, 6), 30000);
		const delay = base + Math.random() * 1000;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			void connect();
		}, delay);
	}

	function disconnect(_opts?: { reason?: "manual" | "idle" }): void {
		// Pause + bump generation so any in-flight `connect()` (e.g. mid-await
		// on resolveParams) aborts before it can create a provider.
		paused = true;
		connectGeneration += 1;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		clearIdleTimer();
		tearDownProvider();
		notifyStatus("disconnected");
	}

	function resume(): void {
		if (destroyed) return;
		// Clear pause and any pending backoff so we don't get overlapping connects.
		paused = false;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		resetIdleTimer();
		if (currentState) return;
		attempt = 0;
		void connect();
	}

	// ── WsProviderHandle adapter ───────────────────────────────────────────────

	const wsProvider: WsProviderHandle = {
		get connected() {
			return Boolean(currentState && (currentState.provider.wsconnected ?? false));
		},
		// Always bound to `doc` and reused across every WebsocketProvider — consumers
		// (e.g. presence-cursor) can destructure at plugin-creation time without races.
		awareness: sharedAwareness,
		broadcast(_msg: Record<string, unknown>): void {
			// y-websocket has no broadcast channel separate from Y.Doc updates; no-op.
		},
		onBroadcast(handler: (msg: Record<string, unknown>) => void): () => void {
			broadcastListeners.add(handler);
			return () => broadcastListeners.delete(handler);
		},
		onStatusChange(handler: (status: WsConnectionStatus) => void): () => void {
			statusListeners.add(handler);
			// Fire current state immediately for parity with createWsProvider behavior.
			// Use the status tracker so pre-provider connection attempts (e.g. while
			// awaiting `resolveParams`) correctly report `"connecting"` instead of
			// `"disconnected"`.
			const snapshot = status.getSnapshot().state;
			const initial: WsConnectionStatus =
				snapshot === "synced"
					? "connected"
					: snapshot === "connecting" || snapshot === "syncing"
						? "connecting"
						: snapshot === "error"
							? "failed"
							: "disconnected";
			handler(initial);
			return () => statusListeners.delete(handler);
		},
		requestPartition(_names: string[]): void {
			// y-websocket has no partition concept; no-op.
		},
		onPartitionMeta(_handler: (meta: unknown) => void): () => void {
			return () => {
				// no-op
			};
		},
		destroy(): void {
			destroy();
		},
	} as WsProviderHandle;

	function destroy(): void {
		if (destroyed) return;
		destroyed = true;
		// Invalidate any in-flight `connect()` awaiting `resolveParams`.
		connectGeneration += 1;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		clearIdleTimer();
		tearDownProvider();
		shapesMap.unobserve(shapesObserver);
		unsubMutation();
		statusListeners.clear();
		broadcastListeners.clear();
		sharedAwareness.destroy();
		if (ownsDoc) {
			doc.destroy();
		}
		settleFirstSync();
	}

	if (autoConnect) {
		void connect();
	}

	return {
		doc,
		status,
		whenSynced,
		wsProvider,
		disconnect: () => disconnect({ reason: "manual" }),
		resume,
		destroy,
	};
}
