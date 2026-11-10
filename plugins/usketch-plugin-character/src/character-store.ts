// The plugin's per-viewer state (never persisted as shapes — it is ephemeral, and
// shared with others only through awareness). A tiny subscribe/notify store so the
// layer, HUD and service all read the same source of truth.
import { type Point, wrapDeg } from "@edv4h/usketch-shared";
import { type CameraMode, defaultCameraHeightMargin } from "./character-camera.js";
import {
	type CharacterPose,
	type ControlScheme,
	DEFAULT_DRIFT,
	DEFAULT_HOVER,
	DEFAULT_JUMP,
	DEFAULT_MOTION,
	type DriftParams,
	type HoverParams,
	type JumpParams,
	type MotionParams,
	ORIGIN_POSE,
} from "./character-physics.js";
import { type CharacterSize, DEFAULT_SIZE, sanitizeSize } from "./character-size.js";
import type { CharacterAppearance, CharacterRenderer, RemoteCharacter } from "./character-types.js";

export interface CharacterState {
	enabled: boolean;
	pose: CharacterPose;
	/** Whether the pose has been placed yet (the first enable spawns at the anchor). */
	spawned: boolean;
	cameraMode: CameraMode;
	controlScheme: ControlScheme;
	motion: MotionParams;
	/** Vehicle drift tuning, or `null` when drifting is off. */
	drift: DriftParams | null;
	/** Jump tuning, or `null` when jumping is off. */
	jump: JumpParams | null;
	/** Screen anchor as fractions of the canvas (0..1). */
	anchor: Point;
	/** 0 = rigid follow … 0.99 = heavy lag. */
	followSmoothing: number;
	/**
	 * Under a 3D view, how far (world units) the body may rise above the ground under it
	 * before the camera height follows it up; `null` = the jump's height (see
	 * `followCameraHeight`).
	 */
	cameraHeightMargin: number | null;
	/** How big the body is drawn (only the look). */
	size: CharacterSize;
	/** True after the user panned by hand; a movement key resumes following. */
	followSuspended: boolean;
	appearance: CharacterAppearance;
	name?: string;
	/** Other clients' characters, keyed by id (display poses, smoothed). */
	remotes: ReadonlyMap<string, RemoteCharacter>;
}

export interface CharacterStoreInit {
	enabled?: boolean;
	cameraMode?: CameraMode;
	controlScheme?: ControlScheme;
	motion?: Partial<MotionParams>;
	drift?: boolean | Partial<DriftParams>;
	jump?: boolean | JumpInit;
	anchor?: Partial<Point>;
	followSmoothing?: number;
	cameraHeightMargin?: number | null;
	size?: Partial<CharacterSize>;
	appearance?: CharacterAppearance;
	name?: string;
	renderer?: CharacterRenderer;
	shadowRenderer?: CharacterRenderer;
}

/** Stopped, wheels straight, no drift (scheme switches). */
const AT_REST = { speed: 0, moving: false, steering: 0, slip: 0, drift: 0 } as const;
/** At rest and grounded: a teleport lands on whatever ground is there (`z` snaps up to it). */
const LANDED = {
	...AT_REST,
	z: 0,
	vz: 0,
	vx: 0,
	vy: 0,
	airborne: false,
	hovering: false,
} as const;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const positive = (v: number, fallback: number) => (Number.isFinite(v) && v > 0 ? v : fallback);
const nonNegative = (v: number, fallback: number) => (Number.isFinite(v) && v >= 0 ? v : fallback);

function sanitizeMotion(m: Partial<MotionParams>, base: MotionParams): MotionParams {
	return {
		moveSpeed: positive(m.moveSpeed ?? base.moveSpeed, base.moveSpeed),
		turnRate: positive(m.turnRate ?? base.turnRate, base.turnRate),
		acceleration: positive(m.acceleration ?? base.acceleration, base.acceleration),
		friction: positive(m.friction ?? base.friction, base.friction),
		reverseRatio: clamp01(m.reverseRatio ?? base.reverseRatio),
		maxStep: nonNegative(m.maxStep ?? base.maxStep, base.maxStep),
		maxSlope: Math.min(89, nonNegative(m.maxSlope ?? base.maxSlope, base.maxSlope)),
		slopeTilt: Number.isFinite(m.slopeTilt) ? clamp01(m.slopeTilt as number) : base.slopeTilt,
	};
}

const finite = (v: number | undefined, fallback: number) =>
	v !== undefined && Number.isFinite(v) ? v : fallback;

/** `true` = defaults, `false` / omitted = off, an object = defaults overridden. */
export function sanitizeDrift(
	d: boolean | Partial<DriftParams> | undefined,
	base: DriftParams = DEFAULT_DRIFT,
): DriftParams | null {
	if (!d) return null;
	if (d === true) return base;
	const nonNegative = (v: number | undefined, fallback: number) => Math.max(0, finite(v, fallback));
	const startSpeed = nonNegative(d.startSpeed, base.startSpeed);
	const turnRate = nonNegative(d.turnRate, base.turnRate);
	return {
		startSpeed,
		// A drift must not end above the speed that starts it.
		stopSpeed: Math.min(startSpeed, nonNegative(d.stopSpeed, base.stopSpeed)),
		turnRate,
		// Countersteering may open the curve, never reverse it.
		steerRate: Math.min(turnRate, nonNegative(d.steerRate, base.steerRate)),
		slipAngle: Math.min(90, nonNegative(d.slipAngle, base.slipAngle)),
		steerSlipAngle: Math.min(90, nonNegative(d.steerSlipAngle, base.steerSlipAngle)),
		recoveryRate: positive(finite(d.recoveryRate, base.recoveryRate), base.recoveryRate),
		hop: typeof d.hop === "boolean" ? d.hop : base.hop,
		hopHeight: nonNegative(d.hopHeight, base.hopHeight),
	};
}

/** Jump tuning as a caller passes it: `hover` also takes `true` / `false` / a partial. */
export type JumpInit = Omit<Partial<JumpParams>, "hover"> & {
	hover?: boolean | Partial<HoverParams> | null;
};

/** The most air jumps accepted (beyond it a jump key held down is flying, not jumping). */
export const MAX_AIR_JUMPS = 99;

/**
 * `true` = on with `tuning` (the last one used, else the defaults), `false` / `null` =
 * off, an object = `tuning` overridden, omitted = `current` unchanged.
 */
export function sanitizeHover(
	h: boolean | Partial<HoverParams> | null | undefined,
	current: HoverParams | null,
	tuning: HoverParams = current ?? DEFAULT_HOVER,
): HoverParams | null {
	if (h === undefined) return current;
	if (!h) return null;
	if (h === true) return tuning;
	return {
		duration: positive(finite(h.duration, tuning.duration), tuning.duration),
		fallSpeed: nonNegative(finite(h.fallSpeed, tuning.fallSpeed), tuning.fallSpeed),
		rechargeTime: nonNegative(finite(h.rechargeTime, tuning.rechargeTime), tuning.rechargeTime),
		thrust: nonNegative(finite(h.thrust, tuning.thrust), tuning.thrust),
		riseSpeed: nonNegative(finite(h.riseSpeed, tuning.riseSpeed), tuning.riseSpeed),
	};
}

/**
 * `true` = defaults, `false` / omitted = off, an object = defaults overridden. `hoverTuning`
 * is what `hover: true` turns on (the last hover tuning, so off → on keeps it).
 */
export function sanitizeJump(
	j: boolean | JumpInit | undefined,
	base: JumpParams = DEFAULT_JUMP,
	hoverTuning: HoverParams = base.hover ?? DEFAULT_HOVER,
): JumpParams | null {
	if (!j) return null;
	if (j === true) return base;
	const seconds = (v: number | undefined, fallback: number) =>
		Math.min(1, Math.max(0, finite(v, fallback)));
	return {
		height: positive(finite(j.height, base.height), base.height),
		timeToApex: positive(finite(j.timeToApex, base.timeToApex), base.timeToApex),
		// Falling slower than rising reads as floaty-wrong; never below 1.
		fallGravity: Math.max(1, finite(j.fallGravity, base.fallGravity)),
		releaseCut: clamp01(finite(j.releaseCut, base.releaseCut)),
		coyoteTime: seconds(j.coyoteTime, base.coyoteTime),
		bufferTime: seconds(j.bufferTime, base.bufferTime),
		airJumps: Math.min(
			MAX_AIR_JUMPS,
			Math.floor(nonNegative(finite(j.airJumps, base.airJumps), base.airJumps)),
		),
		airJumpRatio: positive(finite(j.airJumpRatio, base.airJumpRatio), base.airJumpRatio),
		hover: sanitizeHover(j.hover, base.hover, hoverTuning),
		slopeRatio: clamp01(finite(j.slopeRatio, base.slopeRatio)),
		airControl: clamp01(finite(j.airControl, base.airControl)),
	};
}

/** The jump tuning in effect (the same for both control schemes). */
export function effectiveJump(state: CharacterState): JumpParams | null {
	return state.jump;
}

/** Height of the drift hop in effect: a vehicle with drift + hop on, else 0. */
export function driftHopHeight(state: CharacterState): number {
	const d = state.drift;
	return state.controlScheme === "vehicle" && d?.hop ? d.hopHeight : 0;
}

/** The hover gauge to show / broadcast: `null` while hovering is off (in effect). */
export function hoverGaugeOf(state: CharacterState): number | null {
	return effectiveJump(state)?.hover ? state.pose.hoverGauge : null;
}

function sanitizeMargin(v: number | null | undefined): number | null {
	return v !== null && v !== undefined && Number.isFinite(v) && v >= 0 ? v : null;
}

/** The camera-height margin in effect (see `CharacterState.cameraHeightMargin`). */
export function cameraHeightMarginOf(state: CharacterState): number {
	return (
		state.cameraHeightMargin ??
		defaultCameraHeightMargin(effectiveJump(state)?.height ?? null, driftHopHeight(state))
	);
}

export function createCharacterStore(init: CharacterStoreInit = {}) {
	let state: CharacterState = {
		enabled: init.enabled ?? false,
		pose: ORIGIN_POSE,
		spawned: false,
		cameraMode: init.cameraMode ?? "fixed",
		controlScheme: init.controlScheme ?? "directional",
		motion: sanitizeMotion(init.motion ?? {}, DEFAULT_MOTION),
		drift: sanitizeDrift(init.drift),
		jump: sanitizeJump(init.jump),
		anchor: { x: clamp01(init.anchor?.x ?? 0.5), y: clamp01(init.anchor?.y ?? 0.5) },
		followSmoothing: Math.min(0.99, Math.max(0, init.followSmoothing ?? 0)),
		cameraHeightMargin: sanitizeMargin(init.cameraHeightMargin),
		size: sanitizeSize(init.size, DEFAULT_SIZE),
		followSuspended: false,
		appearance: init.appearance ?? {},
		name: init.name,
		remotes: new Map(),
	};
	let renderer: CharacterRenderer | undefined = init.renderer;
	let shadowRenderer: CharacterRenderer | undefined = init.shadowRenderer;
	// The tunings survive turning drift / jump off, so turning them back on keeps them.
	let driftTuning: DriftParams = state.drift ?? DEFAULT_DRIFT;
	let jumpTuning: JumpParams = state.jump ?? DEFAULT_JUMP;
	let hoverTuning: HoverParams = state.jump?.hover ?? DEFAULT_HOVER;
	const listeners = new Set<() => void>();

	const set = (patch: Partial<CharacterState>): void => {
		state = { ...state, ...patch };
		for (const l of listeners) l();
	};

	return {
		getState: (): CharacterState => state,
		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		getRenderer: (): CharacterRenderer | undefined => renderer,
		setRenderer(fn: CharacterRenderer | undefined): void {
			renderer = fn;
			set({}); // re-render with the new look
		},
		getShadowRenderer: (): CharacterRenderer | undefined => shadowRenderer,
		setShadowRenderer(fn: CharacterRenderer | undefined): void {
			shadowRenderer = fn;
			set({});
		},
		setEnabled(enabled: boolean): void {
			if (enabled !== state.enabled) set({ enabled, followSuspended: false });
		},
		setPose(pose: CharacterPose): void {
			if (pose !== state.pose) set({ pose, spawned: true });
		},
		setPosition(p: Point): void {
			set({ pose: { ...state.pose, ...LANDED, x: p.x, y: p.y }, spawned: true });
		},
		setHeading(deg: number): void {
			set({ pose: { ...state.pose, heading: wrapDeg(deg) } });
		},
		setCameraMode(cameraMode: CameraMode): void {
			if (cameraMode !== state.cameraMode) set({ cameraMode, followSuspended: false });
		},
		setControlScheme(controlScheme: ControlScheme): void {
			if (controlScheme !== state.controlScheme) {
				set({ controlScheme, pose: { ...state.pose, ...AT_REST } });
			}
		},
		setMotion(m: Partial<MotionParams>): void {
			set({ motion: sanitizeMotion(m, state.motion) });
		},
		/** `true` = on (current or default tuning), `false` = off, an object = tuning overrides. */
		setDrift(d: boolean | Partial<DriftParams>): void {
			const drift = sanitizeDrift(d, driftTuning);
			if (drift) driftTuning = drift;
			set({ drift });
		},
		/**
		 * `true` = on (current or default tuning), `false` = off, an object = tuning
		 * overrides (its `hover`: `true` / `false` / a partial, as for the jump).
		 */
		setJump(j: boolean | JumpInit): void {
			const jump = sanitizeJump(j, jumpTuning, hoverTuning);
			if (jump) jumpTuning = jump;
			if (jump?.hover) hoverTuning = jump.hover;
			set({ jump });
		},
		setAnchor(a: Partial<Point>): void {
			set({
				anchor: { x: clamp01(a.x ?? state.anchor.x), y: clamp01(a.y ?? state.anchor.y) },
			});
		},
		setFollowSmoothing(v: number): void {
			if (Number.isFinite(v)) set({ followSmoothing: Math.min(0.99, Math.max(0, v)) });
		},
		/** `null` = the jump's height; a negative / non-finite value also falls back to it. */
		setCameraHeightMargin(v: number | null): void {
			set({ cameraHeightMargin: sanitizeMargin(v) });
		},
		/** Change the body size; omitted fields keep their current value. */
		setSize(s: Partial<CharacterSize>): void {
			set({ size: sanitizeSize(s, state.size) });
		},
		setFollowSuspended(followSuspended: boolean): void {
			if (followSuspended !== state.followSuspended) set({ followSuspended });
		},
		setAppearance(appearance: CharacterAppearance): void {
			set({ appearance });
		},
		setName(name: string | undefined): void {
			set({ name });
		},
		setRemotes(remotes: ReadonlyMap<string, RemoteCharacter>): void {
			set({ remotes });
		},
	};
}

export type CharacterStore = ReturnType<typeof createCharacterStore>;
