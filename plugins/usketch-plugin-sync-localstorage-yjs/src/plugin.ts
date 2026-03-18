import type { UsketchPlugin } from "@edv4h/usketch-shared";
import type { YjsSyncHandle } from "./yjs-sync.js";
import { createYjsSync } from "./yjs-sync.js";

const DOC_NAME = "usketch-default";

export const syncLocalstorageYjsPlugin: UsketchPlugin = {
	id: "usketch-plugin-sync-localstorage-yjs",
	name: "ローカル永続化 (Yjs + IndexedDB)",

	async setup(ctx) {
		const handle = createYjsSync(ctx.store, DOC_NAME);

		// Expose sync status on window for DebugHUD to pick up
		(globalThis as Record<string, unknown>).__usketchSyncStatus = handle.status;

		// Wait for IndexedDB restoration before continuing plugin setup chain
		await handle.whenSynced;

		// Store handle for teardown
		(this as { _handle?: YjsSyncHandle })._handle = handle;
	},

	teardown() {
		const handle = (this as { _handle?: YjsSyncHandle })._handle;
		handle?.destroy();
		delete (globalThis as Record<string, unknown>).__usketchSyncStatus;
		delete (this as { _handle?: YjsSyncHandle })._handle;
	},
};
