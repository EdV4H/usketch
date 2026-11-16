import { defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import type { SessionClient } from "./session-client.js";
import type { ClientSessionType } from "./session-type.js";

/**
 * The session plugin's host-facing API, so a host can draw its own session UI
 * (start a session from its own menu, show its own banner) without the Control
 * HUD. Same operations as the panel uses.
 */
export interface SessionApi extends Omit<SessionClient, "dispose"> {
	/** This client's userId. */
	readonly userId: string;
	/** The registered client-side session types. */
	readonly types: readonly ClientSessionType[];
}

/** Typed service handle for the session API. Provided in `setup`, read via {@link getSessionApi}. */
export const sessionService = defineService<SessionApi>("usketch-plugin-session");

/** Host accessor: `getSessionApi(app.services)?.create({ type: "voting", … })`. */
export function getSessionApi(services: ServiceRegistry): SessionApi | undefined {
	return sessionService.get(services);
}
