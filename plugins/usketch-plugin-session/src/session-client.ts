import type {
	ClientToServer,
	ServerToClient,
	SessionConfig,
	SessionView,
} from "@edv4h/usketch-session-protocol";
import type { WsProviderHandle } from "@edv4h/usketch-sync";

/**
 * Snapshot of all live sessions this client currently knows about. Rebuilt on
 * every server message so `useSyncExternalStore` gets a stable, referentially-new
 * value per change. The **server is authoritative** — this is a read-through
 * mirror, never a source of truth. Payloads are type-agnostic: `public` and
 * private data are `unknown` and narrowed by each session type's renderer.
 */
export interface SessionClientState {
	/** Active sessions, oldest first. */
	sessions: SessionView[];
	/** This client's own private state per sessionId (opaque; type-specific shape). */
	privates: Record<string, unknown>;
	/** Last server-reported error (cleared on the next successful `state`). */
	error: string | null;
}

export interface SessionClient {
	/** Current snapshot (stable identity until the next change). */
	getState(): SessionClientState;
	/** Subscribe to snapshot changes. Returns an unsubscribe fn. */
	subscribe(listener: () => void): () => void;

	create(config: SessionConfig): void;
	join(sessionId: string): void;
	/** Send a type-specific action (opaque; the session type validates it server-side). */
	act(sessionId: string, action: unknown): void;
	close(sessionId: string): void;
	/** Host-only: end the session and remove it for everyone. */
	end(sessionId: string): void;
	leave(sessionId: string): void;
	/** Re-request all current sessions (also sent automatically on (re)connect). */
	sync(): void;

	dispose(): void;
}

/**
 * Client-side session mirror over the `MSG_SESSION` channel. Wraps
 * `wsProvider.sendSession` / `onSession`, keeps a local map of the public
 * {@link SessionView}s plus this client's private state, and re-syncs whenever
 * the socket (re)connects so a mid-join or a reconnect catches up automatically.
 * Type-agnostic: it never inspects `public`/private payloads.
 */
export function createSessionClient(wsProvider: WsProviderHandle): SessionClient {
	const sessions = new Map<string, SessionView>();
	const privates = new Map<string, unknown>();
	let error: string | null = null;

	const listeners = new Set<() => void>();
	let snapshot: SessionClientState = compute();

	function compute(): SessionClientState {
		return {
			sessions: [...sessions.values()].sort((a, b) => a.createdAt - b.createdAt),
			privates: Object.fromEntries(privates),
			error,
		};
	}

	function emit() {
		snapshot = compute();
		for (const listener of listeners) listener();
	}

	function apply(msg: ServerToClient) {
		switch (msg.t) {
			case "state":
				if (msg.session.status === "ended") {
					sessions.delete(msg.session.id);
					privates.delete(msg.session.id);
				} else {
					sessions.set(msg.session.id, msg.session);
				}
				error = null;
				break;
			case "private":
				privates.set(msg.sessionId, msg.data);
				break;
			case "ended":
				sessions.delete(msg.sessionId);
				privates.delete(msg.sessionId);
				break;
			case "error":
				error = msg.message;
				break;
		}
		emit();
	}

	function send(msg: ClientToServer) {
		wsProvider.sendSession(msg as unknown as Record<string, unknown>);
	}

	const offSession = wsProvider.onSession((raw) => apply(raw as unknown as ServerToClient));

	// (Re)sync on every connect: a mid-join or a dropped-and-restored socket
	// catches up on all current sessions. `sendSession` drops silently while the
	// socket is closed, so we only send once we know it is open.
	if (wsProvider.connected) send({ t: "sync" });
	const offStatus = wsProvider.onStatusChange((status) => {
		if (status === "connected") send({ t: "sync" });
	});

	return {
		getState: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		create: (config) => send({ t: "create", config }),
		join: (sessionId) => send({ t: "join", sessionId }),
		act: (sessionId, action) => send({ t: "action", sessionId, action }),
		close: (sessionId) => send({ t: "close", sessionId }),
		end: (sessionId) => send({ t: "end", sessionId }),
		leave: (sessionId) => send({ t: "leave", sessionId }),
		sync: () => send({ t: "sync" }),
		dispose() {
			offSession();
			offStatus();
			listeners.clear();
			sessions.clear();
			privates.clear();
		},
	};
}
