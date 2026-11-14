// Host-facing API on the `ctx.services` seam: everything the HUD does, plus the
// render/appearance hooks, as typed calls a host or another plugin can drive.
import { defineService, type Point, type ServiceRegistry } from "@edv4h/usketch-shared";
import type { CameraMode } from "./character-camera.js";
import { type KeyStorage, saveStoredKeys } from "./character-keys.js";
import type {
	CharacterPose,
	ControlScheme,
	DriftParams,
	JumpParams,
	MotionParams,
} from "./character-physics.js";
import type { CharacterRuntime } from "./character-runtime.js";
import type { CharacterSize } from "./character-size.js";
import type { CharacterStore, JumpInit } from "./character-store.js";
import type {
	CharacterAppearance,
	CharacterKeys,
	CharacterRenderer,
	RemoteCharacter,
} from "./character-types.js";
import type { VirtualInput } from "./character-virtual-input.js";

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
	setJump(jump: boolean | JumpInit): void;
	/** Jump now, as if the jump key were pressed and held (no-op while off or disabled). */
	jump(): void;
	/** Screen anchor as canvas fractions (0..1). */
	getAnchor(): Point;
	setAnchor(anchor: Partial<Point>): void;
	/** Follow smoothing (0 = rigid … 0.99 = heavy lag). */
	getFollowSmoothing(): number;
	setFollowSmoothing(value: number): void;
	/**
	 * Under a 3D view, how far (world units) the body may rise above the ground before the
	 * camera height follows it up. `null` (default) = the jump's height, so an ordinary
	 * jump doesn't bob the view; `0` = the camera follows the body's height exactly.
	 */
	getCameraHeightMargin(): number | null;
	setCameraHeightMargin(value: number | null): void;
	/** How big the body is drawn (a fixed screen size, or one that scales with the ground). */
	getSize(): CharacterSize;
	/** Change the body size; omitted fields keep their current value. Only the look. */
	setSize(size: Partial<CharacterSize>): void;
	/**
	 * Replace the key bindings (`KeyboardEvent.code` values; omitted `drift` / `jump` are
	 * kept): rebinds the keymap's `CHARACTER_KEY_IDS` for the viewer, where the app's key
	 * settings keep them. `save` only matters on hosts without a keymap (deprecated).
	 * @deprecated Use the keymap (`keymap.setKeys(CHARACTER_KEY_IDS.up, codes)`).
	 */
	setKeys(keys: CharacterKeys, options?: { save?: boolean }): void;
	/** The current key bindings. */
	getKeys(): CharacterKeys;
	/**
	 * The host's bindings (the plugin's `keys` option over the defaults, and the app's
	 * `createApp({ keymap: { keys } })` for the `CHARACTER_KEY_IDS` bindings over those).
	 */
	getDefaultKeys(): CharacterKeys;
	/** Back to {@link getDefaultKeys}, forgetting this viewer's saved bindings. */
	resetKeys(): void;
	/** Listen for key binding changes. Returns an unsubscribe. */
	onKeysChange(listener: () => void): () => void;
	/**
	 * For a key-config UI: the next key press goes to `onKey` (its `KeyboardEvent.code`)
	 * instead of moving the character, wherever focus is. Returns a cancel.
	 * @deprecated The app's key settings pick keys themselves (keymap gate).
	 */
	captureNextKey(onKey: (code: string) => void): () => void;
	/**
	 * Drive with a non-keyboard control (an on-screen stick, a gamepad …): analog
	 * `throttle` / `steer` (-1 … 1) and the `drift` button, combined with the held keys.
	 * Send the current state on every change and `null` (or all zero) on release.
	 * Ignored while the character is off, and turning it off releases it.
	 */
	setVirtualInput(input: Partial<VirtualInput> | null): void;
	/** The virtual control's current input, or `null` when released. */
	getVirtualInput(): VirtualInput | null;
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

export interface CharacterKeyConfig {
	/** @deprecated Unused: "reset" goes back to the keymap's defaults (`getDefaultKeys`). */
	defaults: CharacterKeys;
	/** Where a viewer's saved bindings live; `null` = not saved. */
	storage: KeyStorage | null;
}

export function createCharacterApi(
	store: CharacterStore,
	runtime: CharacterRuntime,
	keyConfig: CharacterKeyConfig = { defaults: runtime.getKeys(), storage: null },
): CharacterApi {
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
		getCameraHeightMargin: () => store.getState().cameraHeightMargin,
		setCameraHeightMargin: (v) => store.setCameraHeightMargin(v),
		getSize: () => store.getState().size,
		setSize: (size) => store.setSize(size),
		setKeys(keys, options) {
			runtime.setKeys(keys);
			if (options?.save) saveStoredKeys(keyConfig.storage, runtime.getKeys());
		},
		getKeys: () => runtime.getKeys(),
		getDefaultKeys: () => runtime.getDefaultKeys(),
		resetKeys() {
			saveStoredKeys(keyConfig.storage, null);
			runtime.setKeys(runtime.getDefaultKeys());
		},
		onKeysChange: (listener) => runtime.onKeysChange(listener),
		captureNextKey: (onKey) => runtime.captureNextKey(onKey),
		setVirtualInput: (input) => runtime.setVirtualInput(input),
		getVirtualInput: () => runtime.getVirtualInput(),
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
