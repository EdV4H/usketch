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
	createPageDocManager,
	type PageDocHandle,
	type PageDocManager,
	type PageDocManagerOptions,
	type PageDocPersistence,
} from "./page-doc-manager.js";
export {
	checkPagesMigration,
	copyRootShapesToPage,
	countRootShapes,
	DEFAULT_FIRST_PAGE_NAME,
	type FinishPagesMigrationOptions,
	type FinishPagesMigrationResult,
	finishPagesMigration,
	moveRootShapesToPage,
	needsPagesMigration,
	type PagesMigrationCheck,
} from "./page-migration.js";
export {
	createPageScopedAwareness,
	createPageScopedProvider,
	PAGE_AWARENESS_FIELD,
	PAGE_BROADCAST_FIELD,
	type PageScopedAwareness,
	type PageScopedProvider,
} from "./page-scope.js";
export {
	BOARD_META_MAP_KEY,
	type CreatePageOptions,
	CURRENT_PAGES_VERSION,
	createPage,
	deletePage,
	getLegacyPageId,
	getPage,
	getPagesVersion,
	initPagedBoard,
	isPagedBoard,
	LEGACY_PAGE_ID_KEY,
	listPages,
	newPageId,
	observePages,
	PAGE_SHAPES_MAP_KEY,
	PAGES_MAP_KEY,
	PAGES_VERSION_KEY,
	type PageMeta,
	pageDocGuid,
	renamePage,
	reorderPage,
	resolvePageId,
	restorePage,
	toPageMeta,
} from "./pages.js";
export {
	type DocFrame,
	decodeDocFrame,
	encodeDocFrame,
	isValidDocId,
	MSG_AWARENESS,
	MSG_BROADCAST,
	MSG_DOC_SUBSCRIBE,
	MSG_DOC_SYNC,
	MSG_DOC_UNSUBSCRIBE,
	MSG_DOC_UPDATE,
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
	type DocSubscription,
	type PartitionMeta,
	type WsConnectionStatus,
	type WsProviderHandle,
	type WsProviderOptions,
} from "./ws-provider.js";
