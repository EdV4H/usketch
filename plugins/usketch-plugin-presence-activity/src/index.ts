export {
	type ActivityFrame,
	type ActivityKeyframe,
	type ActivityMotion,
	type BuildMotionOptions,
	boxCenter,
	buildMotion,
	createMotionClock,
	DEFAULT_MOTION_HOP_MS,
	DEFAULT_MOTION_TOUR_MS,
	MAX_KEYFRAMES,
	MAX_MOTION_MS,
	MAX_MOVES_PER_KEYFRAME,
	type MotionClock,
	type MotionPoint,
	type MotionStop,
	type MotionTiming,
	motionDuration,
	motionFinalCursor,
	motionStopTimes,
	normalizeMotion,
	type ShapeMove,
	sampleMotion,
	visitShapes,
} from "@edv4h/usketch-presence-motion";
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
