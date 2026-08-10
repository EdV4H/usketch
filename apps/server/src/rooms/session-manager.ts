import type {
	ClientToServer,
	Participant,
	PublicState,
	ServerToClient,
	SessionAction,
	SessionConfig,
	SessionType,
	SessionView,
} from "@edv4h/usketch-session-protocol";
import { type ServerSessionType, votingType } from "./session-types/voting.js";

/** Server-authoritative session record (secret state is never sent as-is). */
interface ServerSession {
	id: string;
	type: SessionType;
	hostUserId: string;
	public: PublicState;
	secret: unknown;
	participants: Map<string, Participant>;
	createdAt: number;
}

interface SnapshotSession extends Omit<ServerSession, "participants"> {
	participants: Participant[];
}

/** Persisted shape (JSON) — participants as arrays, plus the grace deadlines. */
export interface SessionSnapshot {
	sessions: SnapshotSession[];
	grace: Record<string, number>;
}

export interface SessionManagerDeps {
	/** Send a message to every socket of one user (targeted). */
	send(userId: string, msg: ServerToClient): void;
	/** Send a message to every connected socket. */
	broadcast(msg: ServerToClient): void;
	now(): number;
	genId(): string;
	/** Persist the current snapshot (called after every mutation). */
	persist(snapshot: SessionSnapshot): void;
	/** Arm (or clear with null) the single DO alarm at an absolute epoch-ms. */
	setAlarm(at: number | null): void;
	/** Reconnect grace window in ms. */
	graceMs: number;
}

const TYPES: Record<SessionType, ServerSessionType> = { voting: votingType };

/**
 * Authoritative manager for all live sessions in one board (Durable Object).
 * Pure/injectable: all I/O (send, broadcast, persistence, alarm, clock, ids)
 * is passed in, so it unit-tests in plain Node without the Workers runtime.
 *
 * Presence & reconnect: {@link onDisconnect} marks a user's participations
 * disconnected and arms a grace timer; a `sync` message (sent on (re)connect)
 * clears the grace and resends state; {@link onAlarm} forfeits participants
 * whose grace expired, migrating the host if needed.
 */
export class SessionManager {
	private sessions = new Map<string, ServerSession>();
	/** userId → grace deadline (epoch ms) while disconnected. */
	private grace = new Map<string, number>();

	constructor(private readonly deps: SessionManagerDeps) {}

	restore(snap: SessionSnapshot | undefined): void {
		if (!snap) return;
		this.sessions.clear();
		this.grace.clear();
		for (const s of snap.sessions) {
			this.sessions.set(s.id, {
				...s,
				participants: new Map(s.participants.map((p) => [p.userId, p])),
			});
		}
		for (const [uid, at] of Object.entries(snap.grace ?? {})) this.grace.set(uid, at);
	}

	private snapshot(): SessionSnapshot {
		return {
			sessions: [...this.sessions.values()].map((s) => ({
				...s,
				participants: [...s.participants.values()],
			})),
			grace: Object.fromEntries(this.grace),
		};
	}

	private commit(): void {
		this.deps.persist(this.snapshot());
	}

	private viewOf(s: ServerSession): SessionView {
		return {
			id: s.id,
			type: s.type,
			hostUserId: s.hostUserId,
			status: "active",
			public: s.public,
			participants: [...s.participants.values()],
			createdAt: s.createdAt,
		};
	}

	private broadcastState(s: ServerSession): void {
		this.deps.broadcast({ t: "state", session: this.viewOf(s) });
	}

	private sendPrivate(userId: string, s: ServerSession): void {
		const priv = TYPES[s.type].privateFor({ public: s.public, secret: s.secret }, userId);
		if (priv != null)
			this.deps.send(userId, { t: "private", sessionId: s.id, data: priv as never });
	}

	private ensureParticipant(s: ServerSession, userId: string): void {
		const existing = s.participants.get(userId);
		if (existing) {
			existing.connected = true;
		} else {
			s.participants.set(userId, {
				userId,
				role: userId === s.hostUserId ? "host" : "participant",
				joinedAt: this.deps.now(),
				connected: true,
			});
		}
	}

	/** If `leavingUserId` was the host, hand host to the earliest-joined connected peer. */
	private migrateHost(s: ServerSession, leavingUserId: string): void {
		if (s.hostUserId !== leavingUserId) return;
		const candidates = [...s.participants.values()]
			.filter((p) => p.userId !== leavingUserId && p.connected)
			.sort((a, b) => a.joinedAt - b.joinedAt);
		const next = candidates[0];
		if (next) {
			s.hostUserId = next.userId;
			next.role = "host";
		}
		// No connected peer → host stays (session dormant); resumes on reconnect.
	}

	// ── client messages ──

	handle(userId: string, msg: ClientToServer): void {
		switch (msg.t) {
			case "sync":
				this.onSync(userId);
				break;
			case "create":
				this.onCreate(userId, msg.config);
				break;
			case "join":
				this.onJoin(userId, msg.sessionId);
				break;
			case "action":
				this.onAction(userId, msg.sessionId, msg.action);
				break;
			case "leave":
				this.onLeave(userId, msg.sessionId);
				break;
			case "close":
				this.onClose(userId, msg.sessionId);
				break;
		}
	}

	private onCreate(userId: string, config: SessionConfig): void {
		const type = config.type;
		if (!TYPES[type]) {
			this.deps.send(userId, { t: "error", message: "unknown session type" });
			return;
		}
		const { public: pub, secret } = TYPES[type].init(config);
		const s: ServerSession = {
			id: this.deps.genId(),
			type,
			hostUserId: userId,
			public: pub,
			secret,
			participants: new Map([
				[userId, { userId, role: "host", joinedAt: this.deps.now(), connected: true }],
			]),
			createdAt: this.deps.now(),
		};
		this.sessions.set(s.id, s);
		this.commit();
		this.broadcastState(s);
		this.sendPrivate(userId, s);
	}

	private onJoin(userId: string, sessionId: string): void {
		const s = this.sessions.get(sessionId);
		if (!s) {
			this.deps.send(userId, { t: "error", message: "no such session", sessionId });
			return;
		}
		this.ensureParticipant(s, userId);
		this.grace.delete(userId);
		this.recomputeAlarm();
		this.commit();
		this.broadcastState(s);
		this.sendPrivate(userId, s);
	}

	private onAction(userId: string, sessionId: string, action: SessionAction): void {
		const s = this.sessions.get(sessionId);
		if (!s) {
			this.deps.send(userId, { t: "error", message: "no such session", sessionId });
			return;
		}
		this.ensureParticipant(s, userId); // acting joins you
		const err = TYPES[s.type].reduce({ public: s.public, secret: s.secret }, action, userId);
		if (err) {
			this.deps.send(userId, { t: "error", message: err, sessionId });
			return;
		}
		this.commit();
		this.broadcastState(s);
		this.sendPrivate(userId, s);
	}

	private onLeave(userId: string, sessionId: string): void {
		const s = this.sessions.get(sessionId);
		if (!s?.participants.has(userId)) return;
		s.participants.delete(userId);
		this.migrateHost(s, userId);
		if (s.participants.size === 0) {
			this.sessions.delete(sessionId);
			this.commit();
			this.deps.broadcast({ t: "ended", sessionId });
			return;
		}
		this.commit();
		this.broadcastState(s);
	}

	/** Host-only: freeze/close the session's activity (e.g. stop accepting votes). */
	private onClose(userId: string, sessionId: string): void {
		const s = this.sessions.get(sessionId);
		if (!s) return;
		if (s.hostUserId !== userId) {
			this.deps.send(userId, { t: "error", message: "host only", sessionId });
			return;
		}
		TYPES[s.type].close?.({ public: s.public, secret: s.secret });
		this.commit();
		this.broadcastState(s);
	}

	// ── presence / reconnect ──

	/** Sent by a client on (re)connect: catch up on all sessions, clear its grace. */
	private onSync(userId: string): void {
		let changed = false;
		if (this.grace.delete(userId)) changed = true;
		for (const s of this.sessions.values()) {
			const p = s.participants.get(userId);
			if (p && !p.connected) {
				p.connected = true;
				changed = true;
			}
			// Send current public state of every active session so the client can
			// see/join ongoing sessions, plus its own private state where relevant.
			this.deps.send(userId, { t: "state", session: this.viewOf(s) });
			if (p) this.sendPrivate(userId, s);
		}
		if (changed) {
			this.recomputeAlarm();
			this.commit();
			// Reflect the reconnect (connected=true) to everyone.
			for (const s of this.sessions.values()) {
				if (s.participants.get(userId)?.connected) this.broadcastState(s);
			}
		}
	}

	/** Last socket for `userId` closed: mark disconnected, arm grace. */
	onDisconnect(userId: string): void {
		let inAny = false;
		for (const s of this.sessions.values()) {
			const p = s.participants.get(userId);
			if (p?.connected) {
				p.connected = false;
				inAny = true;
				this.broadcastState(s);
			}
		}
		if (!inAny) return;
		this.grace.set(userId, this.deps.now() + this.deps.graceMs);
		this.recomputeAlarm();
		this.commit();
	}

	/** DO alarm fired: forfeit participants whose grace expired. */
	onAlarm(): void {
		const now = this.deps.now();
		const expired = [...this.grace.entries()].filter(([, at]) => at <= now).map(([uid]) => uid);
		if (expired.length === 0) {
			this.recomputeAlarm();
			return;
		}
		for (const uid of expired) {
			this.grace.delete(uid);
			for (const s of [...this.sessions.values()]) {
				if (!s.participants.has(uid)) continue;
				s.participants.delete(uid);
				this.migrateHost(s, uid);
				if (s.participants.size === 0) {
					this.sessions.delete(s.id);
					this.deps.broadcast({ t: "ended", sessionId: s.id });
				} else {
					this.broadcastState(s);
				}
			}
		}
		this.recomputeAlarm();
		this.commit();
	}

	private recomputeAlarm(): void {
		let earliest: number | null = null;
		for (const at of this.grace.values()) earliest = earliest == null ? at : Math.min(earliest, at);
		this.deps.setAlarm(earliest);
	}
}
