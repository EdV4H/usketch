import type {
	Participant,
	ServerSessionType,
	SessionConfig,
	SessionType,
	SessionView,
} from "@edv4h/usketch-session-protocol";
import * as Y from "yjs";
import type { SessionClient, SessionClientState } from "./session-client.js";

/** Default root map holding one log per session. */
export const YJS_SESSIONS_MAP = "usketchSessions";

/**
 * One entry of a session's log. A session is stored as an append-only log in
 * the shared document, and every peer folds the same log into the same state.
 * A log (not a snapshot) is what makes concurrent actions safe: two people who
 * act at the same moment both land, in the order Yjs gives every peer, instead
 * of one overwriting the other.
 */
export type YjsSessionLogEntry =
	| { t: "create"; by: string; at: number; config: SessionConfig }
	| { t: "join"; by: string; at: number }
	| { t: "action"; by: string; at: number; action: unknown }
	/**
	 * `heir`: who the leaving host hands over to, picked by the leaver among the
	 * peers online (the fold cannot see presence). Omitted = earliest joined.
	 */
	| { t: "leave"; by: string; at: number; heir?: string }
	| { t: "close"; by: string; at: number }
	/**
	 * `by` takes over as host from `from` (written only while `from` was away).
	 * Applied only while `from` is still the host, so of two claims at once the
	 * first in the log wins, as on the server.
	 */
	| { t: "host"; by: string; at: number; from: string };

/** Who is online, for {@link Participant.connected}. Shaped like y-protocols' Awareness. */
export interface YjsSessionPresence {
	getStates(): Map<number, unknown>;
	on(event: "change", listener: () => void): void;
	off(event: "change", listener: () => void): void;
}

export interface YjsSessionClientOptions {
	/** The shared document every peer of the board syncs. */
	doc: Y.Doc;
	/** This client's userId (the actor recorded in the log; host detection). */
	userId: string;
	/**
	 * The session types' rules. Here they run on every peer instead of on a server,
	 * so this takes the **server** half ({@link ServerSessionType}). A type that
	 * {@link ServerSessionType.requiresServer requires the server} cannot be created.
	 */
	types: readonly ServerSessionType[];
	/** Online peers. Without it every participant counts as connected. */
	presence?: YjsSessionPresence;
	/**
	 * How long the host must have been gone from `presence` before
	 * {@link SessionClient.claimHost} goes through, so a reload or a presence
	 * that has not synced yet does not hand the session over. Default 10 000.
	 */
	hostAwayMs?: number;
	/** Reads the userId from one presence state. Default: `state.user.id`. */
	userIdOf?: (state: unknown) => string | undefined;
	/** Root map name. Default {@link YJS_SESSIONS_MAP}. */
	mapName?: string;
	now?: () => number;
	genId?: () => string;
}

type Folded = {
	view: SessionView;
	state: { public: unknown; secret: unknown };
	def: ServerSessionType;
};

const defaultUserIdOf = (state: unknown): string | undefined => {
	const user = (state as { user?: { id?: unknown } } | null)?.user;
	if (user && (typeof user.id === "string" || typeof user.id === "number")) return String(user.id);
	return undefined;
};

const defaultGenId = (): string =>
	typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
		? crypto.randomUUID()
		: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Deep copy for JSON-shaped state, so a rejected `reduce` leaves nothing behind. */
const clone = <T>(value: T): T =>
	value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);

const needsServer = (def: ServerSessionType, config: SessionConfig): boolean =>
	def.requiresServer?.(config) === true;

/**
 * Replay one session's log. Pure and deterministic: the same entries give the
 * same state on every peer. Mirrors the server's `SessionManager` rules —
 * acting joins you, a rejected action changes nothing, only the host may close,
 * a leaving host hands over to the heir they named (else the earliest joined),
 * a `host` entry makes its writer the host (joining them if needed) only while
 * its `from` is still the host, and the session ends when nobody is left
 * (returns `null`).
 */
export function foldSessionLog(
	id: string,
	entries: readonly YjsSessionLogEntry[],
	types: ReadonlyMap<SessionType, ServerSessionType>,
): Folded | null {
	const first = entries[0];
	if (first?.t !== "create") return null;
	const def = types.get(first.config.type);
	if (!def || needsServer(def, first.config)) return null;

	const initial = def.init(clone(first.config));
	let state = { public: initial.public, secret: initial.secret };
	let hostUserId = first.by;
	const participants = new Map<string, Participant>([
		[first.by, { userId: first.by, role: "host", joinedAt: first.at, connected: true }],
	]);
	const ensure = (userId: string, at: number) => {
		if (participants.has(userId)) return;
		participants.set(userId, {
			userId,
			role: userId === hostUserId ? "host" : "participant",
			joinedAt: at,
			connected: true,
		});
	};

	for (const e of entries.slice(1)) {
		switch (e.t) {
			case "join":
				ensure(e.by, e.at);
				break;
			case "action": {
				ensure(e.by, e.at);
				const next = clone(state);
				if (!def.reduce(next, e.action, e.by)) state = next;
				break;
			}
			case "leave": {
				if (!participants.delete(e.by)) break;
				if (participants.size === 0) return null;
				if (hostUserId === e.by) {
					const named = e.heir === undefined ? undefined : participants.get(e.heir);
					const heir =
						named ?? [...participants.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];
					if (heir) {
						hostUserId = heir.userId;
						heir.role = "host";
					}
				}
				break;
			}
			case "host": {
				if (e.from !== hostUserId) break;
				ensure(e.by, e.at);
				const previous = participants.get(hostUserId);
				if (previous) previous.role = "participant";
				hostUserId = e.by;
				const next = participants.get(e.by);
				if (next) next.role = "host";
				break;
			}
			case "close": {
				if (e.by !== hostUserId || !def.close) break;
				const next = clone(state);
				def.close(next);
				state = next;
				break;
			}
		}
	}

	return {
		def,
		state,
		view: {
			id,
			type: def.type,
			hostUserId,
			status: "active",
			public: state.public,
			participants: [...participants.values()],
			createdAt: first.at,
		},
	};
}

/**
 * A {@link SessionClient} that keeps sessions in a shared Yjs document instead
 * of on a server. Use it where the board syncs through Yjs but no session server
 * exists (a y-websocket host, a local board): the same session types run, and
 * every peer sees the same state.
 *
 * Trust model: there is no authority. Each peer runs the types' `reduce` over
 * the shared log, so rules hold for honest clients, but anyone can read the
 * whole document — `secret` is **not** hidden here. That is why a type that
 * {@link ServerSessionType.requiresServer requires the server} is refused.
 * Ending a session deletes its log; only the host's client does that, by
 * convention rather than enforcement. Likewise `claimHost` is checked locally:
 * it goes through only once the host has been gone from `presence` for
 * `hostAwayMs`, and never without `presence`.
 */
export function createYjsSessionClient(options: YjsSessionClientOptions): SessionClient {
	const { doc, userId, presence } = options;
	const map = doc.getMap<Y.Array<YjsSessionLogEntry>>(options.mapName ?? YJS_SESSIONS_MAP);
	const types = new Map(options.types.map((t) => [t.type, t]));
	const now = options.now ?? Date.now;
	const genId = options.genId ?? defaultGenId;
	const userIdOf = options.userIdOf ?? defaultUserIdOf;
	const hostAwayMs = options.hostAwayMs ?? 10_000;
	const startedAt = now();

	const listeners = new Set<() => void>();
	let folded = new Map<string, Folded>();
	let error: string | null = null;
	let snapshot: SessionClientState = { sessions: [], privates: {}, error: null };

	const online = (): Set<string> | null => {
		if (!presence) return null;
		const ids = new Set<string>();
		for (const state of presence.getStates().values()) {
			const id = userIdOf(state);
			if (id !== undefined) ids.add(id);
		}
		return ids;
	};

	// When each user was last seen in `presence`: on every change, everyone who was
	// online until now is stamped, so a user who just left keeps the time they left.
	const lastSeen = new Map<string, number>();
	let wasOnline = online();
	const onPresence = () => {
		const at = now();
		for (const id of wasOnline ?? []) lastSeen.set(id, at);
		wasOnline = online();
		emit();
	};

	const rebuild = () => {
		const next = new Map<string, Folded>();
		for (const [id, log] of map.entries()) {
			const f = foldSessionLog(id, log.toArray(), types);
			if (f) next.set(id, f);
		}
		folded = next;
	};

	const emit = () => {
		const ids = online();
		const sessions = [...folded.values()]
			.map((f) =>
				ids
					? {
							...f.view,
							participants: f.view.participants.map((p) => ({
								...p,
								connected: ids.has(p.userId),
							})),
						}
					: f.view,
			)
			.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
		const privates: Record<string, unknown> = {};
		for (const [id, f] of folded) {
			if (!f.view.participants.some((p) => p.userId === userId)) continue;
			const priv = f.def.privateFor(f.state, userId);
			if (priv != null) privates[id] = priv;
		}
		snapshot = { sessions, privates, error };
		for (const listener of listeners) listener();
	};

	// Like the server's `state` message, any change clears the last error.
	const refresh = () => {
		error = null;
		rebuild();
		emit();
	};

	const fail = (message: string) => {
		error = message;
		emit();
	};

	const append = (sessionId: string, entry: YjsSessionLogEntry) => {
		const log = map.get(sessionId);
		if (!log) return false;
		error = null;
		log.push([entry]);
		return true;
	};

	map.observeDeep(refresh);
	presence?.on("change", onPresence);
	rebuild();
	emit();

	return {
		getState: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		create(config) {
			const def = types.get(config.type);
			if (!def) return fail("unknown session type");
			if (needsServer(def, config)) return fail("this session type needs the session server");
			const log = new Y.Array<YjsSessionLogEntry>();
			log.push([{ t: "create", by: userId, at: now(), config: clone(config) }]);
			error = null;
			map.set(genId(), log);
		},
		join(sessionId) {
			if (!folded.has(sessionId)) return fail("no such session");
			append(sessionId, { t: "join", by: userId, at: now() });
		},
		act(sessionId, action) {
			const f = folded.get(sessionId);
			if (!f) return fail("no such session");
			// Check locally first, so a rejected action reports back and never enters
			// the log. Concurrent actions are re-checked when every peer folds the log.
			const err = f.def.reduce(clone(f.state), action, userId);
			if (err) return fail(err);
			append(sessionId, { t: "action", by: userId, at: now(), action: clone(action) });
		},
		close(sessionId) {
			const f = folded.get(sessionId);
			if (!f) return;
			if (f.view.hostUserId !== userId) return fail("host only");
			append(sessionId, { t: "close", by: userId, at: now() });
		},
		end(sessionId) {
			const f = folded.get(sessionId);
			if (!f) return;
			if (f.view.hostUserId !== userId) return fail("host only");
			error = null;
			map.delete(sessionId);
		},
		leave(sessionId) {
			const f = folded.get(sessionId);
			if (!f?.view.participants.some((p) => p.userId === userId)) return;
			// The last one out ends it: drop the log rather than leave an empty one behind.
			if (f.view.participants.length === 1) {
				error = null;
				map.delete(sessionId);
				return;
			}
			// A leaving host hands over to the earliest-joined peer who is online, as
			// the server does. Without presence the fold falls back to the earliest joined.
			const ids = online();
			const heir =
				f.view.hostUserId === userId && ids
					? f.view.participants
							.filter((p) => p.userId !== userId && ids.has(p.userId))
							.sort((a, b) => a.joinedAt - b.joinedAt)[0]?.userId
					: undefined;
			append(sessionId, { t: "leave", by: userId, at: now(), ...(heir ? { heir } : {}) });
		},
		claimHost(sessionId) {
			const f = folded.get(sessionId);
			if (!f) return fail("no such session");
			if (f.view.hostUserId === userId) return;
			const ids = online();
			if (!ids) return fail("taking over needs presence");
			const host = f.view.hostUserId;
			if (ids.has(host)) return fail("the host is here");
			const awaySince = Math.max(startedAt, lastSeen.get(host) ?? 0);
			if (now() - awaySince < hostAwayMs) return fail("the host may come back");
			append(sessionId, { t: "host", by: userId, at: now(), from: host });
		},
		sync: refresh,
		dispose() {
			map.unobserveDeep(refresh);
			presence?.off("change", onPresence);
			listeners.clear();
			folded.clear();
		},
	};
}
