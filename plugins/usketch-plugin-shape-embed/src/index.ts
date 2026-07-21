export {
	CODESANDBOX_DEF,
	DEFAULT_EMBED_DEFS,
	type EmbedDefinition,
	FIGMA_DEF,
	GENERIC_DEF,
	GOOGLE_MAPS_DEF,
	type ResolvedEmbed,
	resolveEmbed,
	VIMEO_DEF,
	YOUTUBE_DEF,
} from "./embed-defs.js";
export {
	DRIFT_THRESHOLD_S,
	needsCorrection,
	playbackFrom,
	projectTime,
} from "./playback.js";
export {
	createEmbedShapePlugin,
	DefaultEmbedChrome,
	EMBED_TYPE,
	type EmbedChrome,
	type EmbedChromeProps,
	type EmbedPluginOptions,
} from "./plugin.js";
export type { EmbedShapeData, EmbedSyncMode, PlaybackState } from "./types.js";
