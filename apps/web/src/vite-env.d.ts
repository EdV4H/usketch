/// <reference types="vite/client" />

import type { SyncStatusTracker } from "@edv4h/usketch-store";

declare global {
	interface Window {
		__usketchSyncStatus?: SyncStatusTracker;
	}
}
