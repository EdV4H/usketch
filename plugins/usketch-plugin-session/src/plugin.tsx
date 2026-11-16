import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { createSessionClient, type SessionClient } from "./session-client.js";
import { SessionPanel } from "./session-panel.js";
import { sessionService } from "./session-service.js";
import type { ClientSessionType } from "./session-type.js";

export interface SessionPluginOptions {
	/** Server-authoritative session transport. Sessions are disabled without it (or `client`). */
	wsProvider?: WsProviderHandle | null;
	/**
	 * Any other transport, e.g. {@link createYjsSessionClient} for a board that syncs
	 * through Yjs but has no session server. Takes precedence over `wsProvider`. The
	 * host owns it: the plugin does not dispose it on teardown, so one client can
	 * outlive the app (a host that rebuilds the app per page keeps its sessions).
	 */
	client?: SessionClient | null;
	/** This client's userId — must match the WS connection's identity (host detection). */
	userId: string;
	/** For future per-board scoping / telemetry. */
	boardId?: string;
	/**
	 * Registered session types (voting, tutorial, cards…). Each renders its own
	 * card + create form. The matching server-side `ServerSessionType` must also
	 * be registered into the Durable Object's SessionManager (server bundle), or
	 * passed to {@link createYjsSessionClient} for the shared-document transport.
	 */
	types: readonly ClientSessionType[];
}

/**
 * Live interactive sessions (voting first) surfaced in the Control HUD and, for
 * hosts with their own UI, through {@link getSessionApi}. With `wsProvider` the
 * **server is authoritative** — this plugin only sends intents and renders the
 * public state the server pushes back. With a `client` such as the Yjs one, the
 * same types run on every peer over the shared document.
 *
 * On a local board with neither, the plugin registers nothing (no-op).
 */
export function createSessionPlugin(options: SessionPluginOptions): UsketchPlugin {
	const { wsProvider, userId, types } = options;

	return {
		id: "usketch-plugin-session",
		name: "セッション",

		setup(ctx: PluginContext) {
			const owned = options.client ? null : wsProvider ? createSessionClient(wsProvider) : null;
			const client = options.client ?? owned;
			if (!client) {
				// Local board: no transport, so sessions are unavailable. No UI.
				return () => {};
			}

			const offService = sessionService.provide(ctx.services, {
				userId,
				types,
				getState: () => client.getState(),
				subscribe: (listener) => client.subscribe(listener),
				create: (config) => client.create(config),
				join: (sessionId) => client.join(sessionId),
				act: (sessionId, action) => client.act(sessionId, action),
				close: (sessionId) => client.close(sessionId),
				end: (sessionId) => client.end(sessionId),
				leave: (sessionId) => client.leave(sessionId),
				sync: () => client.sync(),
			});

			const detach = types.flatMap((t) => {
				const off = t.attach?.({
					client,
					userId,
					store: ctx.store,
					services: ctx.services,
					events: ctx.events,
				});
				return off ? [off] : [];
			});

			// UI lives entirely in the HUD panel. The panel's own create form has
			// labelled fields, so we deliberately do NOT also register a generic
			// `ctx.actions` create form — the HUD renders action params as bare,
			// unlabelled inputs, which is confusing for a multi-field form.
			const offPanel = ctx.hud.registerPanel({
				id: "session:panel",
				title: "セッション",
				order: 40,
				render: () => <SessionPanel client={client} userId={userId} types={types} />,
			});

			return () => {
				offPanel();
				for (const off of detach) off();
				offService();
				owned?.dispose();
			};
		},
	};
}
