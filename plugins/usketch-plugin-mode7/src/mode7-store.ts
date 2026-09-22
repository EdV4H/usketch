// Reactive shared state for one Mode 7 plugin instance: the active flag, the camera
// geometry, and the appearance ("look" = sky color, fog). The runtime / service /
// HUD mutate it; the layer React components subscribe via `useSyncExternalStore`.
// Kept tiny and framework-agnostic (same pattern as bg-grid's visibility store).
import type { BoundingBox } from "@edv4h/usketch-shared";
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

/** Clamp a value into 0..1 (non-finite → 1, the "full draw distance" default). */
function clampUnit(n: number): number {
	if (!Number.isFinite(n)) return 1;
	return Math.min(1, Math.max(0, n));
}

/**
 * Layers tilted by default: essentially everything on the board EXCEPT the persistent
 * UI chrome that must stay flat/readable (vim status line / which-key / help, the side
 * panel, the presentation overlay) — plus the plugin's own overlays + the HUD, which
 * are always excluded from the picker. The set is runtime-selectable via the HUD, so
 * this is only the starting selection. Ids not present on a given board are ignored.
 */
export const DEFAULT_TILT_LAYER_IDS: readonly string[] = [
	// backgrounds / content
	"bg-grid",
	"bg-dots",
	"island-metaball",
	"gpu-shapes",
	"dom-shapes",
	"usketch-plugin-dashboard:grid-overlay",
	// shape-attached overlays (selection, connectors, editors) — follow the shapes
	"comment-badges",
	"connector-anchor-handles",
	"__selection-foreground",
	"connector-endpoints",
	"connector-label-editor",
	"usketch-plugin-shape-frame:title-editor",
	"domain-connector-properties",
	"unconfirmed-shapes-overlay",
	// interaction / presence overlays anchored to the board
	"vim-overlay",
	"snap-guides",
	"laser",
	"freedraw-cursor",
	"spotlight",
	"follow-banner",
	"whistle-indicator",
	"voice-notes-indicator",
	"transient",
	"portal",
	"usketch-presence-activity",
];

export interface Mode7State {
	active: boolean;
	camera: Camera;
	look: Look;
	/** Layer ids currently rendered in 3D (user-selectable at runtime). */
	tiltLayers: string[];
	/** How far toward the horizon the ground is drawn, 0..1 (1 = to the horizon / no
	 *  clip; smaller = a closer far-cutoff that hides distant content). */
	drawDistance: number;
	/** Whether to draw the "capture frame" overlay in flat mode (HUD toggle). */
	showCaptureFrame: boolean;
	/**
	 * The world-space rectangle the 3D ground plane covers, snapshotted at the moment
	 * the view was last switched on (`null` before the first switch / seed). Shapes
	 * outside it don't appear in the initial 3D view — the frame makes that visible.
	 * The runtime sets this (it needs the canvas pixel size); the store only holds it.
	 */
	captureRect: BoundingBox | null;
}

export interface Mode7Init {
	active?: boolean;
	camera?: Partial<Camera>;
	look?: Partial<Look>;
	tiltLayers?: readonly string[];
	drawDistance?: number;
	showCaptureFrame?: boolean;
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
	/** Set the ground draw distance, 0..1 (clamped). */
	setDrawDistance(distance: number): void;
	/** Show/hide the flat-mode capture-frame overlay. */
	setCaptureFrame(show: boolean): void;
	/** Flip the capture-frame overlay visibility. */
	toggleCaptureFrame(): void;
	/** Store the captured world rect (called by the runtime; `null` clears it). */
	setCaptureRect(rect: BoundingBox | null): void;
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
		drawDistance: clampUnit(init.drawDistance ?? 1),
		showCaptureFrame: init.showCaptureFrame ?? false,
		captureRect: null,
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
		setDrawDistance(distance) {
			const d = clampUnit(distance);
			if (state.drawDistance === d) return;
			state = { ...state, drawDistance: d };
			notify();
		},
		setCaptureFrame(show) {
			if (state.showCaptureFrame === show) return;
			state = { ...state, showCaptureFrame: show };
			notify();
		},
		toggleCaptureFrame() {
			state = { ...state, showCaptureFrame: !state.showCaptureFrame };
			notify();
		},
		setCaptureRect(rect) {
			state = { ...state, captureRect: rect };
			notify();
		},
		reset() {
			state = { ...state, camera: baseCamera, look: baseLook };
			notify();
		},
	};
}
