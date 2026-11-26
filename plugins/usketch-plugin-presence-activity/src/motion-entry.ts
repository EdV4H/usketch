/**
 * `@edv4h/usketch-plugin-presence-activity/motion`: the motion format and its
 * builders without the React plugin, for code that publishes activity from outside
 * the editor (e.g. a server-side agent writing to the board).
 */
export {
	type ActivityFrame,
	type ActivityKeyframe,
	type ActivityMotion,
	createMotionClock,
	MAX_KEYFRAMES,
	MAX_MOTION_MS,
	MAX_MOVES_PER_KEYFRAME,
	type MotionClock,
	type MotionPoint,
	motionDuration,
	normalizeMotion,
	type ShapeMove,
	sampleMotion,
} from "./motion.js";
export {
	type BuildMotionOptions,
	boxCenter,
	buildMotion,
	DEFAULT_MOTION_HOP_MS,
	DEFAULT_MOTION_TOUR_MS,
	type MotionStop,
	type MotionTiming,
	motionFinalCursor,
	motionStopTimes,
	visitShapes,
} from "./motion-builder.js";
