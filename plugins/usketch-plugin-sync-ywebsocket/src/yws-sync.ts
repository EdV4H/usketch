import type { BoardStore, ShapeData } from "@edv4h/usketch-shared";
import type { WsConnectionStatus, WsProviderHandle } from "@edv4h/usketch-sync";
import type { Awareness } from "y-protocols/awareness";
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

	// A long-lived Awareness bound to `doc` — reused across reconnects so consumers
	// (e.g., presence-cursor) can subscribe once.
	let sharedAwareness: Awareness | null = null;

	// WsProviderHandle event listener sets — persist across reconnects.
	const statusListeners = new Set<(status: WsConnectionStatus) => void>();
	const broadcastListeners = new Set<(msg: Record<string, unknown>) => void>();

	function notifyStatus(next: WsConnectionStatus): void {
		status.update({
			state:
				next === "connected"
					? "synced"
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
		isSyncing = true;
		try {
			for (const [id, value] of shapesMap.entries()) {
				const shape = value as unknown as ShapeData;
				if (!store.getShape(id)) {
					store.addShape(shape);
				}
			}
		} finally {
			isSyncing = false;
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
		if (destroyed || currentState) return;

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
				connParams = resolved.params ?? {};
			} catch (err) {
				status.update({
					state: "error",
					error: err instanceof Error ? err.message : String(err),
				});
				scheduleReconnect();
				return;
			}
		}

		if (destroyed) return;

		const provider = new WebsocketProvider(url, roomName, doc, {
			connect: true,
			params: connParams,
			WebSocketPolyfill: WebSocketPolyfill as typeof WebSocket | undefined,
			resyncInterval: 0,
		});

		// Reuse a single Awareness instance across reconnects.
		if (!sharedAwareness) {
			sharedAwareness = provider.awareness;
		}

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
				attempt = 0; // don't apply backoff for explicit retry
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
		if (currentState) return;
		attempt = 0;
		void connect();
	}

	// ── WsProviderHandle adapter ───────────────────────────────────────────────

	const wsProvider: WsProviderHandle = {
		get connected() {
			return Boolean(currentState && (currentState.provider.wsconnected ?? false));
		},
		// Lazily provisioned — first call to `connect()` populates `sharedAwareness`.
		// If someone reads this before we've connected, create a detached Awareness on `doc`.
		get awareness(): Awareness {
			if (sharedAwareness) return sharedAwareness;
			// Defer import of y-protocols to avoid duplicating implementations.
			// This branch is only hit if `autoConnect: false` AND awareness is accessed
			// before `resume()`. Consumers are expected to call `resume()` first.
			throw new Error(
				"[usketch-plugin-sync-ywebsocket] awareness is not available until the first connection — call resume() first or enable autoConnect.",
			);
		},
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
			handler(
				currentState?.provider.wsconnected
					? "connected"
					: currentState
						? "connecting"
						: "disconnected",
			);
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
