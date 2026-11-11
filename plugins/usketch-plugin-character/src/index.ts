export {
	anchorPx,
	type CameraFocus,
	type CameraMode,
	easeFocus,
	followCameraHeight,
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
	type AirTiltParams,
	type Attitude,
	airJumpSpeed,
	attitudeError,
	attitudeUp,
	blockingHeight,
	type CharacterPose,
	type ControlScheme,
	DEFAULT_AIR_TILT,
	DEFAULT_DRIFT,
	DEFAULT_HOVER,
	DEFAULT_JUMP,
	DEFAULT_MOTION,
	type DriftParams,
	drainHoverGauge,
	groundAttitude,
	type HoverParams,
	headingVector,
	IDLE_JUMP,
	IDLE_TILT_LATCH,
	inputSteer,
	inputThrottle,
	type JumpParams,
	type JumpTimers,
	jumpArc,
	LEVEL,
	type MotionParams,
	type MoveInput,
	ORIGIN_POSE,
	rechargeHoverGauge,
	type SolidAt,
	SWEEP_STEP,
	standingHeight,
	stepAirTilt,
	stepCharacter,
	stepVertical,
	sweepToGround,
	type TiltLatch,
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
	type CharacterSize,
	type CharacterSizeScale,
	characterSizePx,
	DEFAULT_SIZE,
	MAX_SIZE_VALUE,
	sanitizeSize,
} from "./character-size.js";
export {
	effectiveAirTilt,
	effectiveJump,
	hoverGaugeOf,
	type JumpInit,
	MAX_AIR_JUMPS,
	sanitizeAirTilt,
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
