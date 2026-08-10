import type { PluginContext, UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import { createSessionClient } from "./session-client.js";
import { SessionPanel } from "./session-panel.js";

export interface SessionPluginOptions {
	/** Server-authoritative session transport. Sessions are disabled without it. */
	wsProvider?: WsProviderHandle | null;
	/** This client's userId — must match the WS connection's identity (host detection). */
	userId: string;
	/** For future per-board scoping / telemetry. */
	boardId?: string;
}

/**
 * Live interactive sessions (voting first) surfaced in the Control HUD. The
 * **server is authoritative** — this plugin only sends intents and renders the
 * public state the server pushes back, so mid-join, reconnect, dedup, secret
 * ballots and host-only ops are all decided server-side.
 *
 * On a local board (no `wsProvider`) sessions require no server, so the plugin
 * registers nothing (per {@link https://github.com/EdV4H/usketch} plan: no-op).
 */
export function createSessionPlugin(options: SessionPluginOptions): UsketchPlugin {
	const { wsProvider, userId } = options;

	return {
		id: "usketch-plugin-session",
		name: "セッション",

		setup(ctx: PluginContext) {
			if (!wsProvider) {
				// Local board: server-authoritative sessions are unavailable. No UI.
				return () => {};
			}

			const client = createSessionClient(wsProvider);

			// UI lives entirely in the HUD panel. The panel's own create form has
			// labelled fields, so we deliberately do NOT also register a generic
			// `ctx.actions` create form — the HUD renders action params as bare,
			// unlabelled inputs, which is confusing for a multi-field form.
			const offPanel = ctx.hud.registerPanel({
				id: "session:panel",
				title: "セッション",
				order: 40,
				render: () => <SessionPanel client={client} userId={userId} />,
			});

			return () => {
				offPanel();
				client.dispose();
			};
		},
	};
}
