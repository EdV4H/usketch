export {
	anchorPx,
	type CameraFocus,
	type CameraMode,
	easeFocus,
	followViewport,
	smoothingAlpha,
	targetRotation,
} from "./character-camera.js";
export {
	KEY_CHOICES,
	type KeyChoice,
	keyChoiceOf,
	withKeyChoice,
} from "./character-key-choices.js";
export {
	airJumpSpeed,
	blockingHeight,
	type CharacterPose,
	type ControlScheme,
	DEFAULT_DRIFT,
	DEFAULT_HOVER,
	DEFAULT_JUMP,
	DEFAULT_MOTION,
	type DriftParams,
	drainHoverGauge,
	type HoverParams,
	headingVector,
	IDLE_JUMP,
	inputSteer,
	inputThrottle,
	type JumpParams,
	type JumpTimers,
	jumpArc,
	type MotionParams,
	type MoveInput,
	ORIGIN_POSE,
	rechargeHoverGauge,
	type SolidAt,
	SWEEP_STEP,
	standingHeight,
	stepCharacter,
	stepVertical,
	sweepToGround,
	turnToward,
	vectorHeading,
} from "./character-physics.js";
export { CHARACTER_LAYER_ID, CHARACTER_VIEWPORT_PRIORITY } from "./character-runtime.js";
export {
	type CharacterApi,
	characterService,
	getCharacterApi,
} from "./character-service.js";
export {
	effectiveJump,
	hoverGaugeOf,
	type JumpInit,
	MAX_AIR_JUMPS,
	sanitizeHover,
	sanitizeJump,
} from "./character-store.js";
export {
	AWARENESS_FIELD,
	type CharacterAwareness,
	type CharacterWireState,
	parseWireState,
} from "./character-sync.js";
export {
	type CharacterAppearance,
	type CharacterKeys,
	type CharacterRenderer,
	type CharacterRenderProps,
	DEFAULT_KEYS,
	type RemoteCharacter,
} from "./character-types.js";
export {
	combineInput,
	isVirtualInputActive,
	normalizeVirtualInput,
	type VirtualInput,
	virtualPresses,
} from "./character-virtual-input.js";
export { type CharacterPluginOptions, createCharacterPlugin } from "./plugin.js";
