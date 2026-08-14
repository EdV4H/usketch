// Re-export the Yjs awareness primitives so consumers (e.g. the MCP client) can
// publish presence without taking a direct `y-protocols` dependency — this
// package already depends on it and frames the awareness message protocol.
export {
	Awareness,
	applyAwarenessUpdate,
	encodeAwarenessUpdate,
	removeAwarenessStates,
} from "y-protocols/awareness";
export {
	MSG_AWARENESS,
	MSG_BROADCAST,
	MSG_PARTITION_META,
	MSG_PARTITION_REQUEST,
	MSG_SESSION,
	MSG_SYNC_STEP1,
	MSG_SYNC_STEP2,
	MSG_YJS_UPDATE,
} from "./protocol.js";
export {
	createServerClock,
	pickBestOffset,
	type ServerClock,
	type ServerClockOptions,
} from "./server-clock.js";
export {
	createWsProvider,
	type PartitionMeta,
	type WsConnectionStatus,
	type WsProviderHandle,
	type WsProviderOptions,
} from "./ws-provider.js";
