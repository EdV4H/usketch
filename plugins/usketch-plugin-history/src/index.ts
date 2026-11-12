export type {
	HistoryClient,
	HistoryClientOptions,
	HistoryCommitDetail,
	HistoryCommitPage,
	HistoryCommitSummary,
	HistoryDiff,
	HistoryShapeModification,
} from "./history-client.js";
export { createHistoryClient, HistoryRequestError } from "./history-client.js";
export type {
	HistoryController,
	HistoryControllerDeps,
	HistoryState,
} from "./history-controller.js";
export { createHistoryController } from "./history-controller.js";
export type { RestoreCommitDeps, RestoreCommitResult } from "./history-ops.js";
export {
	enterPreview,
	exitPreview,
	restoreCommit,
	restoreShapes,
	shortHash,
} from "./history-ops.js";
export { HistoryPanel } from "./history-panel.js";
export type { HistoryApi } from "./history-service.js";
export { getHistoryApi, historyService } from "./history-service.js";
export type { HistoryPluginOptions } from "./plugin.js";
export { createHistoryPlugin } from "./plugin.js";
