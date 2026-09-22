// Reactive shared state for one Mode 7 plugin instance: the active flag, the camera
// geometry, and the appearance ("look" = sky color, fog). The runtime / service /
// HUD mutate it; the layer React components subscribe via `useSyncExternalStore`.
// Kept tiny and framework-agnostic (same pattern as bg-grid's visibility store).
import { type Camera, clampCamera, DEFAULT_CAMERA, updateCamera } from "./mode7-camera.js";

/** Appearance settings, independent of the camera geometry. */
export interface Look {
	/** Sky backdrop color (CSS) painted behind the tilted plane. */
	sky: string;
	/** Fog density near the horizon, 0..1 (0 = no fog). */
	fog: number;
	/** Fog color (CSS). */
	fogColor: string;
}

export const DEFAULT_LOOK: Look = { sky: "#0b1026", fog: 0.35, fogColor: "#0b1026" };

/** Board content layers tilted by default (Shapes + backgrounds). The set is
 *  runtime-selectable via the HUD, so this is only the starting selection. */
export const DEFAULT_TILT_LAYER_IDS: readonly string[] = [
	"dom-shapes",
	"gpu-shapes",
	"bg-grid",
	"bg-dots",
	"island-metaball",
];

export interface Mode7State {
	active: boolean;
	camera: Camera;
	look: Look;
	/** Layer ids currently rendered in 3D (user-selectable at runtime). */
	tiltLayers: string[];
}

export interface Mode7Init {
	active?: boolean;
	camera?: Partial<Camera>;
	look?: Partial<Look>;
	tiltLayers?: readonly string[];
}

export interface Mode7Store {
	getState(): Mode7State;
	subscribe(cb: () => void): () => void;
	setActive(active: boolean): void;
	toggle(): void;
	setCamera(patch: Partial<Camera>): void;
	adjustCamera(delta: Partial<Camera>): void;
	setLook(patch: Partial<Look>): void;
	/** Replace the whole set of tilted layer ids. */
	setTiltLayers(ids: readonly string[]): void;
	/** Add/remove one layer id from the tilted set. */
	toggleTiltLayer(id: string): void;
	reset(): void;
}

export function createMode7Store(init: Mode7Init = {}): Mode7Store {
	const baseCamera = clampCamera({ ...DEFAULT_CAMERA, ...init.camera });
	const baseLook: Look = { ...DEFAULT_LOOK, ...init.look };
	let state: Mode7State = {
		active: init.active ?? false,
		camera: baseCamera,
		look: baseLook,
		tiltLayers: [...(init.tiltLayers ?? DEFAULT_TILT_LAYER_IDS)],
	};

	const listeners = new Set<() => void>();
	const notify = () => {
		for (const l of listeners) l();
	};

	return {
		getState: () => state,
		subscribe(cb) {
			listeners.add(cb);
			return () => {
				listeners.delete(cb);
			};
		},
		setActive(active) {
			if (state.active === active) return;
			state = { ...state, active };
			notify();
		},
		toggle() {
			state = { ...state, active: !state.active };
			notify();
		},
		setCamera(patch) {
			state = { ...state, camera: updateCamera(state.camera, patch) };
			notify();
		},
		adjustCamera(delta) {
			state = {
				...state,
				camera: updateCamera(state.camera, {
					pitch: state.camera.pitch + (delta.pitch ?? 0),
					yaw: state.camera.yaw + (delta.yaw ?? 0),
					fov: state.camera.fov + (delta.fov ?? 0),
					horizon: state.camera.horizon + (delta.horizon ?? 0),
				}),
			};
			notify();
		},
		setLook(patch) {
			state = { ...state, look: { ...state.look, ...patch } };
			notify();
		},
		setTiltLayers(ids) {
			state = { ...state, tiltLayers: [...new Set(ids)] };
			notify();
		},
		toggleTiltLayer(id) {
			const has = state.tiltLayers.includes(id);
			state = {
				...state,
				tiltLayers: has ? state.tiltLayers.filter((x) => x !== id) : [...state.tiltLayers, id],
			};
			notify();
		},
		reset() {
			state = { ...state, camera: baseCamera, look: baseLook };
			notify();
		},
	};
}
