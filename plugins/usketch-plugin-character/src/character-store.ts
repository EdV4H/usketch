// The plugin's per-viewer state (never persisted as shapes — it is ephemeral, and
// shared with others only through awareness). A tiny subscribe/notify store so the
// layer, HUD and service all read the same source of truth.
import { type Point, wrapDeg } from "@edv4h/usketch-shared";
import type { CameraMode } from "./character-camera.js";
import {
	type CharacterPose,
	type ControlScheme,
	DEFAULT_MOTION,
	type MotionParams,
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
	anchor?: Partial<Point>;
	followSmoothing?: number;
	appearance?: CharacterAppearance;
	name?: string;
	renderer?: CharacterRenderer;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const positive = (v: number, fallback: number) => (Number.isFinite(v) && v > 0 ? v : fallback);

function sanitizeMotion(m: Partial<MotionParams>, base: MotionParams): MotionParams {
	return {
		moveSpeed: positive(m.moveSpeed ?? base.moveSpeed, base.moveSpeed),
		turnRate: positive(m.turnRate ?? base.turnRate, base.turnRate),
		acceleration: positive(m.acceleration ?? base.acceleration, base.acceleration),
		friction: positive(m.friction ?? base.friction, base.friction),
		reverseRatio: clamp01(m.reverseRatio ?? base.reverseRatio),
	};
}

export function createCharacterStore(init: CharacterStoreInit = {}) {
	let state: CharacterState = {
		enabled: init.enabled ?? false,
		pose: { x: 0, y: 0, heading: 0, speed: 0, moving: false },
		spawned: false,
		cameraMode: init.cameraMode ?? "fixed",
		controlScheme: init.controlScheme ?? "directional",
		motion: sanitizeMotion(init.motion ?? {}, DEFAULT_MOTION),
		anchor: { x: clamp01(init.anchor?.x ?? 0.5), y: clamp01(init.anchor?.y ?? 0.5) },
		followSmoothing: Math.min(0.99, Math.max(0, init.followSmoothing ?? 0)),
		followSuspended: false,
		appearance: init.appearance ?? {},
		name: init.name,
		remotes: new Map(),
	};
	let renderer: CharacterRenderer | undefined = init.renderer;
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
			set({ pose: { ...state.pose, x: p.x, y: p.y, speed: 0, moving: false }, spawned: true });
		},
		setHeading(deg: number): void {
			set({ pose: { ...state.pose, heading: wrapDeg(deg) } });
		},
		setCameraMode(cameraMode: CameraMode): void {
			if (cameraMode !== state.cameraMode) set({ cameraMode, followSuspended: false });
		},
		setControlScheme(controlScheme: ControlScheme): void {
			if (controlScheme !== state.controlScheme) {
				set({ controlScheme, pose: { ...state.pose, speed: 0, moving: false } });
			}
		},
		setMotion(m: Partial<MotionParams>): void {
			set({ motion: sanitizeMotion(m, state.motion) });
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
