import type { UsketchPlugin } from "@edv4h/usketch-shared";
import { createYjsSync } from "./yjs-sync.js";

const DOC_NAME = "usketch-default";

export function createSyncLocalstorageYjsPlugin(): UsketchPlugin {
	return {
		id: "usketch-plugin-sync-localstorage-yjs",
		name: "ローカル永続化 (Yjs + IndexedDB)",

		async setup(ctx) {
			const handle = createYjsSync(ctx.store, DOC_NAME);

			// Wait for IndexedDB restoration before continuing plugin setup chain
			await handle.whenSynced;

			return () => {
				handle.destroy();
			};
		},
	};
}
