import type { SessionConfig, SessionView } from "@edv4h/usketch-session-protocol";
import type { BoardStore, EventBus, ServiceRegistry } from "@edv4h/usketch-shared";
import type { ReactElement } from "react";
import type { SessionClient } from "./session-client.js";

/**
 * Client-side contract a **session type** implements to render itself inside the
 * framework's HUD panel. The framework owns transport, presence, reconnect and
 * the host lifecycle; a type owns only its own create form + card rendering and
 * sends intents through the provided contexts.
 *
 * Payloads are opaque at the framework level (`public` / `myPrivate` are
 * `unknown`); a type narrows them to its own shapes inside `renderCard`
 * (`ctx.session.public as MyPublic`). This keeps the registry free of generic
 * variance while each type stays strongly typed internally.
 */
export interface ClientSessionType {
	/** Matches {@link SessionView.type} / {@link SessionConfig.type}. */
	type: string;
	/** Human label for the create menu (e.g. "投票"). */
	label: string;
	/**
	 * Render this type's create form. `ctx.create` sends it; `ctx.dismiss` closes the form.
	 * Omit it for a type whose host draws its own UI (via {@link getSessionApi}); the
	 * HUD panel then offers no create button for it.
	 */
	renderCreateForm?(ctx: SessionCreateContext): ReactElement | null;
	/** Render one live session card. Omit it to keep the type out of the HUD panel's list. */
	renderCard?(ctx: SessionCardContext): ReactElement | null;
	/**
	 * Side effects that follow the session state on this client — e.g. move the
	 * camera when a session of this type starts. Called once when the plugin is set
	 * up; return a cleanup. The type subscribes to `ctx.client` itself and picks
	 * out its own sessions (`session.type === this.type`).
	 */
	attach?(ctx: SessionAttachContext): (() => void) | undefined;
}

/** Context passed to {@link ClientSessionType.attach}. */
export interface SessionAttachContext {
	/** The session transport (server or shared document). */
	client: SessionClient;
	/** This client's userId. */
	userId: string;
	/** The board, for types whose effects touch it (camera, shapes). */
	store: BoardStore;
	/** Other plugins' services. */
	services: ServiceRegistry;
	/** The board's event bus (e.g. to claim the load-time camera with `viewport:claimed`). */
	events: EventBus;
}

/** Context passed to a type's create form. */
export interface SessionCreateContext {
	/** Create a session of this type (`config.type` must be the type's id). */
	create(config: SessionConfig): void;
	/** Close the create form without creating. */
	dismiss(): void;
}

/** Context passed to a type's card renderer for one live session. */
export interface SessionCardContext {
	/** The public session view (narrow `session.public` to the type's shape). */
	session: SessionView;
	/** Whether this client is the session's host. */
	isHost: boolean;
	/** This client's userId (for host/self indicators). */
	me: string;
	/** This client's private state for the session, if any (narrow to the type's shape). */
	myPrivate: unknown;
	/** Send a type-specific action to the server. */
	act(action: unknown): void;
	/** Host-only: freeze/close the session (keep it visible). */
	close(): void;
	/** Host-only: end the session and remove it for everyone. */
	end(): void;
	/** Leave the session (stay a non-participant). */
	leave(): void;
	/** Take over as host while the host is away (refused while they are here). */
	claimHost(): void;
}
