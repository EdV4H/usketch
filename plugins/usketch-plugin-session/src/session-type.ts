import type { SessionConfig, SessionView } from "@edv4h/usketch-session-protocol";
import type { ReactElement } from "react";

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
	/** Render this type's create form. `ctx.create` sends it; `ctx.dismiss` closes the form. */
	renderCreateForm(ctx: SessionCreateContext): ReactElement | null;
	/** Render one live session card. */
	renderCard(ctx: SessionCardContext): ReactElement | null;
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
}
