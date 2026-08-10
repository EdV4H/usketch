/**
 * Shared client↔server contract for live interactive sessions (voting first,
 * tutorial / card-game later). Types only — no runtime. Imported by both
 * `apps/server` (authoritative SessionManager) and the client session plugin.
 *
 * Transport: a dedicated `MSG_SESSION` WebSocket frame carrying a JSON
 * {@link ClientToServer} / {@link ServerToClient} message. The **server is
 * authoritative**: it owns each session's state, enforces rules (dedup, host-only
 * ops, turn order), keeps secret state (who-voted-what, face-down cards) server-
 * side, broadcasts only the public view to everyone, and sends private state to
 * the owning user's sockets alone.
 */

/** Registered session kinds. Extend as new types land. */
export type SessionType = "voting";

/** A logical participant (keyed by userId; one user may hold several tabs). */
export interface Participant {
	userId: string;
	role: "host" | "participant";
	joinedAt: number;
	/** Live connection state (false during the reconnect grace window). */
	connected: boolean;
}

// ── Public state (broadcast to everyone) ──

export interface VotingPublicState {
	type: "voting";
	question: string;
	options: string[];
	/** Vote count per option (index-aligned with `options`). */
	tally: number[];
	/** Number of distinct users who have voted. */
	totalVoters: number;
	/** Secret ballot: the server never reveals who voted for what (only tallies). */
	secret: boolean;
	/** Whether a voter may pick multiple options. */
	multi: boolean;
	status: "open" | "closed";
}

export type PublicState = VotingPublicState;

/** A session as seen by clients (fully public — safe to show anyone). */
export interface SessionView {
	id: string;
	type: SessionType;
	hostUserId: string;
	status: "active" | "ended";
	public: PublicState;
	participants: Participant[];
	createdAt: number;
}

// ── Create config ──

export interface VotingConfig {
	type: "voting";
	question: string;
	options: string[];
	secret?: boolean;
	multi?: boolean;
}

export type SessionConfig = VotingConfig;

// ── Actions (client → server, type-specific) ──

export interface VoteCastAction {
	kind: "cast";
	optionIndex: number;
}

export type SessionAction = VoteCastAction;

// ── Private state (server → the owning client only) ──

export interface VotingPrivateState {
	type: "voting";
	/** Option indexes this user has voted for. */
	myVotes: number[];
}

export type PrivateState = VotingPrivateState;

// ── Wire messages ──

export type ClientToServer =
	| { t: "create"; config: SessionConfig }
	| { t: "join"; sessionId: string }
	| { t: "action"; sessionId: string; action: SessionAction }
	| { t: "leave"; sessionId: string }
	/** Host-only: stop the activity but keep it visible (e.g. freeze the tally). */
	| { t: "close"; sessionId: string }
	/** Host-only: end the session entirely and remove it for everyone. */
	| { t: "end"; sessionId: string }
	/** Sent on (re)connect to catch up on all current sessions. */
	| { t: "sync" };

export type ServerToClient =
	| { t: "state"; session: SessionView }
	| { t: "private"; sessionId: string; data: PrivateState }
	| { t: "ended"; sessionId: string }
	| { t: "error"; message: string; sessionId?: string };
