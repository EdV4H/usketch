import type { UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import type { YwebsocketSyncHandle, YwebsocketSyncOptions } from "./types.js";
import { createYwebsocketSync } from "./yws-sync.js";

export interface YwebsocketSyncPlugin extends UsketchPlugin {
	/**
	 * Returns the underlying `WsProviderHandle` for consumption by other plugins
	 * (e.g. `@edv4h/usketch-plugin-presence-cursor`).
	 * Only valid after the plugin's `setup` has run.
	 */
	getWsProvider(): WsProviderHandle;
	/** Access the full sync handle — status, Y.Doc, disconnect/resume/destroy. */
	getHandle(): YwebsocketSyncHandle;
}

export function createYwebsocketSyncPlugin(options: YwebsocketSyncOptions): YwebsocketSyncPlugin {
	let handle: YwebsocketSyncHandle | null = null;

	const plugin: YwebsocketSyncPlugin = {
		id: "usketch-plugin-sync-ywebsocket",
		name: "Realtime Sync (y-websocket)",

		async setup(ctx) {
			handle = createYwebsocketSync(ctx.store, options);
			// Expose status for DebugHUD etc.
			(globalThis as Record<string, unknown>).__usketchSyncStatus = handle.status;
			await handle.whenSynced;
		},

		teardown() {
			handle?.destroy();
			delete (globalThis as Record<string, unknown>).__usketchSyncStatus;
			handle = null;
		},

		getWsProvider(): WsProviderHandle {
			if (!handle) {
				throw new Error(
					"[usketch-plugin-sync-ywebsocket] getWsProvider() called before setup(); register the plugin first.",
				);
			}
			return handle.wsProvider;
		},

		getHandle(): YwebsocketSyncHandle {
			if (!handle) {
				throw new Error(
					"[usketch-plugin-sync-ywebsocket] getHandle() called before setup(); register the plugin first.",
				);
			}
			return handle;
		},
	};

	return plugin;
}
