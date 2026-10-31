// Host-facing API on the `ctx.services` seam: everything the HUD does, plus the
// render/appearance hooks, as typed calls a host or another plugin can drive.
import { defineService, type Point, type ServiceRegistry } from "@edv4h/usketch-shared";
import type { CameraMode } from "./character-camera.js";
import type {
	CharacterPose,
	ControlScheme,
	DriftParams,
	JumpParams,
	MotionParams,
} from "./character-physics.js";
import type { CharacterRuntime } from "./character-runtime.js";
import type { CharacterStore } from "./character-store.js";
import type {
	CharacterAppearance,
	CharacterKeys,
	CharacterRenderer,
	RemoteCharacter,
} from "./character-types.js";

export interface CharacterApi {
	isEnabled(): boolean;
	enable(): void;
	disable(): void;
	toggle(): void;
	/** Local character pose (world position, heading, speed). */
	getPose(): CharacterPose;
	/** Teleport the local character (world coordinates). */
	setPosition(p: Point): void;
	/** Face a direction (degrees, 0 = up, clockwise). */
	setHeading(deg: number): void;
	/** Move the character to the world point under its screen anchor. */
	placeAtAnchor(): void;
	getCameraMode(): CameraMode;
	setCameraMode(mode: CameraMode): void;
	getControlScheme(): ControlScheme;
	setControlScheme(scheme: ControlScheme): void;
	getMotion(): MotionParams;
	setMotion(motion: Partial<MotionParams>): void;
	/** Vehicle drift tuning, or `null` when drifting is off. */
	getDrift(): DriftParams | null;
	/** `true` = on (current or default tuning), `false` = off, an object = tuning overrides. */
	setDrift(drift: boolean | Partial<DriftParams>): void;
	/** Jump tuning, or `null` when jumping is off. */
	getJump(): JumpParams | null;
	/** `true` = on (current or default tuning), `false` = off, an object = tuning overrides. */
	setJump(jump: boolean | Partial<JumpParams>): void;
	/** Jump now, as if the jump key were pressed and held (no-op while off or disabled). */
	jump(): void;
	/** Screen anchor as canvas fractions (0..1). */
	getAnchor(): Point;
	setAnchor(anchor: Partial<Point>): void;
	/** Follow smoothing (0 = rigid … 0.99 = heavy lag). */
	getFollowSmoothing(): number;
	setFollowSmoothing(value: number): void;
	/** Replace the key bindings (`KeyboardEvent.code` values; omitted `drift` / `jump` are kept). */
	setKeys(keys: CharacterKeys): void;
	/** Swap the character renderer (`undefined` = draw nothing). */
	setRenderer(renderer: CharacterRenderer | undefined): void;
	/** Swap the shadow renderer, drawn on the ground under each character (`undefined` = none). */
	setShadowRenderer(renderer: CharacterRenderer | undefined): void;
	/** Replace the broadcast appearance data. */
	setAppearance(appearance: CharacterAppearance): void;
	/** Other clients' live characters. */
	getRemotes(): ReadonlyMap<string, RemoteCharacter>;
	/** Fire on any state change. Returns an unsubscribe. */
	onChange(listener: () => void): () => void;
}

export const characterService = defineService<CharacterApi>("usketch-plugin-character");

export function createCharacterApi(store: CharacterStore, runtime: CharacterRuntime): CharacterApi {
	return {
		isEnabled: () => store.getState().enabled,
		enable: () => store.setEnabled(true),
		disable: () => store.setEnabled(false),
		toggle: () => store.setEnabled(!store.getState().enabled),
		getPose: () => store.getState().pose,
		setPosition: (p) => store.setPosition(p),
		setHeading: (deg) => store.setHeading(deg),
		placeAtAnchor: () => runtime.placeAtAnchor(),
		getCameraMode: () => store.getState().cameraMode,
		setCameraMode: (mode) => store.setCameraMode(mode),
		getControlScheme: () => store.getState().controlScheme,
		setControlScheme: (scheme) => store.setControlScheme(scheme),
		getMotion: () => store.getState().motion,
		setMotion: (motion) => store.setMotion(motion),
		getDrift: () => store.getState().drift,
		setDrift: (drift) => store.setDrift(drift),
		getJump: () => store.getState().jump,
		setJump: (jump) => store.setJump(jump),
		jump: () => runtime.jump(),
		getAnchor: () => store.getState().anchor,
		setAnchor: (anchor) => store.setAnchor(anchor),
		getFollowSmoothing: () => store.getState().followSmoothing,
		setFollowSmoothing: (v) => store.setFollowSmoothing(v),
		setKeys: (keys) => runtime.setKeys(keys),
		setRenderer: (r) => store.setRenderer(r),
		setShadowRenderer: (r) => store.setShadowRenderer(r),
		setAppearance: (a) => store.setAppearance(a),
		getRemotes: () => store.getState().remotes,
		onChange: (listener) => store.subscribe(listener),
	};
}

/** Host accessor: `getCharacterApi(app.services)?.enable()`. Undefined when inactive. */
export function getCharacterApi(services: ServiceRegistry): CharacterApi | undefined {
	return characterService.get(services);
}
