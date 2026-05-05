import type { UsketchPlugin } from "@edv4h/usketch-shared";
import type { WsProviderHandle } from "@edv4h/usketch-sync";
import type { YwebsocketSyncHandle, YwebsocketSyncOptions } from "./types.js";
import { UnconfirmedOverlay } from "./unconfirmed-overlay.js";
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

const UNCONFIRMED_OVERLAY_LAYER_ID = "unconfirmed-shapes-overlay";

export function createYwebsocketSyncPlugin(options: YwebsocketSyncOptions): YwebsocketSyncPlugin {
	let handle: YwebsocketSyncHandle | null = null;
	let unregisterOverlay: (() => void) | null = null;

	const plugin: YwebsocketSyncPlugin = {
		id: "usketch-plugin-sync-ywebsocket",
		name: "Realtime Sync (y-websocket)",

		async setup(ctx) {
			handle = createYwebsocketSync(ctx.store, options);
			(globalThis as Record<string, unknown>).__usketchSyncStatus = handle.status;

			// Diagnostic overlay: draws a red badge on shapes that exist locally
			// but haven't been confirmed by the server. Sits between standard
			// shapes (default order) and the debug HUD (9999).
			const overlayHandle = handle;
			ctx.layers.register({
				id: UNCONFIRMED_OVERLAY_LAYER_ID,
				order: 250,
				fixed: true,
				render: (renderCtx) => (
					<UnconfirmedOverlay
						store={ctx.store}
						shapes={ctx.shapes}
						viewport={renderCtx.viewport}
						syncStatus={overlayHandle.status}
					/>
				),
			});
			unregisterOverlay = () => ctx.layers.unregister(UNCONFIRMED_OVERLAY_LAYER_ID);

			// When `autoConnect: false`, `connect()` is never called, so awaiting
			// `whenSynced` here would hang the entire plugin setup chain. Skip it
			// and let the caller drive connection via `handle.resume()`.
			if (options.autoConnect !== false) {
				await handle.whenSynced;
			}
		},

		teardown() {
			unregisterOverlay?.();
			unregisterOverlay = null;
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
