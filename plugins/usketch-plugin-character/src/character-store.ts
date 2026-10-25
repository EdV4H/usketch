// The plugin's per-viewer state (never persisted as shapes — it is ephemeral, and
// shared with others only through awareness). A tiny subscribe/notify store so the
// layer, HUD and service all read the same source of truth.
import { type Point, wrapDeg } from "@edv4h/usketch-shared";
import type { CameraMode } from "./character-camera.js";
import {
	type CharacterPose,
	type ControlScheme,
	DEFAULT_DRIFT,
	DEFAULT_MOTION,
	type DriftParams,
	type MotionParams,
	ORIGIN_POSE,
} from "./character-physics.js";
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
	/** Screen anchor as fractions of the canvas (0..1). */
	anchor: Point;
	/** 0 = rigid follow … 0.99 = heavy lag. */
	followSmoothing: number;
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
	anchor?: Partial<Point>;
	followSmoothing?: number;
	appearance?: CharacterAppearance;
	name?: string;
	renderer?: CharacterRenderer;
}

/** Stopped, wheels straight, no drift (teleports and scheme switches). */
const AT_REST = { speed: 0, moving: false, steering: 0, slip: 0, drift: 0 } as const;

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
	};
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
		anchor: { x: clamp01(init.anchor?.x ?? 0.5), y: clamp01(init.anchor?.y ?? 0.5) },
		followSmoothing: Math.min(0.99, Math.max(0, init.followSmoothing ?? 0)),
		followSuspended: false,
		appearance: init.appearance ?? {},
		name: init.name,
		remotes: new Map(),
	};
	let renderer: CharacterRenderer | undefined = init.renderer;
	// The tuning survives turning drift off, so turning it back on keeps it.
	let driftTuning: DriftParams = state.drift ?? DEFAULT_DRIFT;
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
		setEnabled(enabled: boolean): void {
			if (enabled !== state.enabled) set({ enabled, followSuspended: false });
		},
		setPose(pose: CharacterPose): void {
			if (pose !== state.pose) set({ pose, spawned: true });
		},
		setPosition(p: Point): void {
			set({ pose: { ...state.pose, ...AT_REST, x: p.x, y: p.y }, spawned: true });
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
		setAnchor(a: Partial<Point>): void {
			set({
				anchor: { x: clamp01(a.x ?? state.anchor.x), y: clamp01(a.y ?? state.anchor.y) },
			});
		},
		setFollowSmoothing(v: number): void {
			if (Number.isFinite(v)) set({ followSmoothing: Math.min(0.99, Math.max(0, v)) });
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
