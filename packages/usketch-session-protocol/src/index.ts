/**
 * Shared client↔server contract for live interactive **sessions** — a generic
 * framework, not one concrete activity. `usketch-plugin-session` provides the
 * transport, presence, reconnect and host lifecycle; individual **session types**
 * (voting, tutorial, card-game) are built on top as separate packages that
 * register a {@link ServerSessionType} on the server and a client renderer on the
 * client. This module is the type-only wire contract shared by both tiers.
 *
 * Transport: a dedicated `MSG_SESSION` WebSocket frame carrying a JSON
 * {@link ClientToServer} / {@link ServerToClient} message. The **server is
 * authoritative**: it owns each session's state, enforces the type's rules (dedup,
 * host-only ops, turn order), keeps secret state (who-voted-what, face-down cards)
 * server-side, broadcasts only the public view to everyone, and sends private
 * state to the owning user's sockets alone.
 *
 * The envelope is intentionally **type-agnostic**: `public` / private `data` /
 * `action` / create `config` (beyond the `type` discriminator) are opaque
 * (`unknown`). Each session type owns and validates its own payload shapes, so
 * new types are added without touching this contract.
 */

/** A session type id (e.g. `"voting"`). Open — any registered type's id. */
export type SessionType = string;

/** A logical participant (keyed by userId; one user may hold several tabs). */
export interface Participant {
	userId: string;
	role: "host" | "participant";
	joinedAt: number;
	/** Live connection state (false during the reconnect grace window). */
	connected: boolean;
}

/**
 * A session as seen by clients (fully public — safe to show anyone).
 * `TPublic` is the session type's public-state shape; opaque at the framework
 * level, narrowed by that type's client renderer.
 */
export interface SessionView<TPublic = unknown> {
	id: string;
	type: SessionType;
	hostUserId: string;
	status: "active" | "ended";
	public: TPublic;
	participants: Participant[];
	createdAt: number;
}

/**
 * Create payload: the `type` discriminator plus that type's own config fields.
 * The framework only reads `type`; the rest is passed through to the type's
 * `init`.
 */
export interface SessionConfig {
	type: SessionType;
	[key: string]: unknown;
}

// ── Wire messages (type-agnostic envelope) ──

export type ClientToServer =
	| { t: "create"; config: SessionConfig }
	| { t: "join"; sessionId: string }
	| { t: "action"; sessionId: string; action: unknown }
	| { t: "leave"; sessionId: string }
	/** Host-only: stop the activity but keep it visible (e.g. freeze the tally). */
	| { t: "close"; sessionId: string }
	/** Host-only: end the session entirely and remove it for everyone. */
	| { t: "end"; sessionId: string }
	/** Sent on (re)connect to catch up on all current sessions. */
	| { t: "sync" };

export type ServerToClient =
	| { t: "state"; session: SessionView }
	| { t: "private"; sessionId: string; data: unknown }
	| { t: "ended"; sessionId: string }
	| { t: "error"; message: string; sessionId?: string };

// ── Server-side session-type contract ──

/**
 * Server-side contract a session type implements. The server owns all logic;
 * clients only render. `public` is broadcast to everyone; `secret` stays
 * server-side and feeds per-user {@link ServerSessionType.privateFor}. Keep
 * `public`/`secret` JSON-serializable so the Durable Object can persist them.
 *
 * A type registers itself by its {@link ServerSessionType.type} id; the
 * authoritative `SessionManager` routes each session to its type by that id.
 * `TPublic`/`TSecret`/`TConfig`/`TAction` are the type's own shapes.
 */
export interface ServerSessionType<
	TPublic = unknown,
	TSecret = unknown,
	TConfig extends SessionConfig = SessionConfig,
	TAction = unknown,
> {
	/** This type's id, matched against {@link SessionConfig.type} / {@link SessionView.type}. */
	readonly type: SessionType;
	/** Build the initial public + secret state from the create config. */
	init(config: TConfig): { public: TPublic; secret: TSecret };
	/**
	 * Apply an actor's action in place (mutate `state.public` / `state.secret`).
	 * Return an error string to reject (nothing is broadcast on error).
	 */
	reduce(
		state: { public: TPublic; secret: TSecret },
		action: TAction,
		actorUserId: string,
	): string | undefined;
	/** The private view for one user (secret ballot receipt / own hand), or null. */
	privateFor(state: { public: TPublic; secret: TSecret }, userId: string): unknown | null;
	/** Host-only "close/freeze" (e.g. stop accepting votes). Optional. */
	close?(state: { public: TPublic; secret: TSecret }): void;
}
