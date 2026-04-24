import type { UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import type { YwebsocketSyncHandle, YwebsocketSyncOptions } from "./types.js";
import { createYwebsocketSync } from "./yws-sync.js";

export interface YwebsocketSyncPlugin extends UsketchPlugin {
	/**
	 * Returns the underlying `WsProviderHandle` for consumption by other plugins
	 * (e.g. `@edv4h/usketch-plugin-presence-cursor`).
	 *
	 * Only valid *after* the plugin's `setup()` has run. See the README for the
	 * recommended pattern (wrap the dependent plugin so it reads the provider
	 * from inside its own `setup()`).
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
					"[usketch-plugin-sync-ywebsocket] getWsProvider() called before setup(); register the plugin with createApp() first, or call getWsProvider() from inside another plugin's setup().",
				);
			}
			return handle.wsProvider;
		},

		getHandle(): YwebsocketSyncHandle {
			if (!handle) {
				throw new Error(
					"[usketch-plugin-sync-ywebsocket] getHandle() called before setup(); register the plugin with createApp() first, or call getHandle() from inside another plugin's setup().",
				);
			}
			return handle;
		},
	};

	return plugin;
}
