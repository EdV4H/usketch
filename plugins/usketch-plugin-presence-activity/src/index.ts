export type { PresenceActivity, PresenceUser } from "./activity.js";
export { collectParticipants } from "./activity-overlay.js";
export {
	type AiActivity,
	type AiActivityStore,
	createAiActivityStore,
} from "./ai-activity-store.js";
export {
	type ActivityFrame,
	type ActivityKeyframe,
	type ActivityMotion,
	createMotionClock,
	MAX_KEYFRAMES,
	MAX_MOTION_MS,
	type MotionClock,
	type MotionPoint,
	motionDuration,
	normalizeMotion,
	sampleMotion,
} from "./motion.js";
export { createPresenceActivityPlugin, type PresenceActivityOptions } from "./plugin.js";
export {
	DEFAULT_ACTIVITY_STYLE,
	type PresenceActivityStyle,
	type PresenceParticipant,
	type ResolvedActivityStyle,
	resolveActivityStyle,
} from "./style.js";
