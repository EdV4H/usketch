export type { PresenceActivity, PresenceUser } from "./activity.js";
export { collectParticipants } from "./activity-overlay.js";
export {
	type AiActivity,
	type AiActivityStore,
	createAiActivityStore,
} from "./ai-activity-store.js";
export { createPresenceActivityPlugin, type PresenceActivityOptions } from "./plugin.js";
export {
	DEFAULT_ACTIVITY_STYLE,
	type PresenceActivityStyle,
	type PresenceParticipant,
	type ResolvedActivityStyle,
	resolveActivityStyle,
} from "./style.js";
