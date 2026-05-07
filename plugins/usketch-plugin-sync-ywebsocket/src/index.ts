// Standalone helpers for apps that wire IDB sync + WsProvider manually
// (rather than via `createYwebsocketSyncPlugin`). `createDivergenceTracker`
// produces a SyncStatusTracker driven by a Y.Doc + WsProvider, and
// `<UnconfirmedOverlay />` renders the SVG badge layer.
export {
	createDivergenceTracker,
	type DivergenceTrackerHandle,
	type DivergenceTrackerOptions,
} from "./divergence-tracker.js";
export { createYwebsocketSyncPlugin, type YwebsocketSyncPlugin } from "./plugin.js";
export {
	type SyncState,
	type SyncStatusSnapshot,
	SyncStatusTracker,
} from "./sync-status-tracker.js";
export type {
	ConnectionParams,
	ResolveParamsContext,
	WsConnectionStatus,
	YwebsocketSyncHandle,
	YwebsocketSyncOptions,
} from "./types.js";
export { UnconfirmedOverlay } from "./unconfirmed-overlay.js";
export { createYwebsocketSync } from "./yws-sync.js";
