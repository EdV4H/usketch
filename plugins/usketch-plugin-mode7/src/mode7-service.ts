// Host-facing API on the `ctx.services` seam (same convention as dashboard/window-
// system): thin, typed delegation to the reactive store so a host or another plugin
// can drive the Mode 7 view without the HUD.
import { type BoundingBox, defineService, type ServiceRegistry } from "@edv4h/usketch-shared";
import type { Camera } from "./mode7-camera.js";
import type { Look, Mode7Store } from "./mode7-store.js";
import type { Mode7SwitchOptions, Mode7Transition } from "./mode7-transition.js";

export interface Mode7Api {
	/** Whether the 3D view is currently shown (still `true` during an exit transition). */
	isActive(): boolean;
	/** Turn the view on. `{ animate: true }` raises the ground from flat and fades the
	 *  sky/fog in; the default follows the plugin's `transition` option. */
	enable(opts?: Mode7SwitchOptions): void;
	/** Turn the view off (animated: back to flat, then inactive). */
	disable(opts?: Mode7SwitchOptions): void;
	/** Flip the view; mid-transition it reverses from the current state. */
	toggle(opts?: Mode7SwitchOptions): void;
	/** Whether an enter/exit transition is running (fires `onChange` per frame). */
	isTransitioning(): boolean;
	/** The rendered transition amount, 0 (flat/off) … 1 (fully 3D), eased. */
	getTransitionAmount(): number;
	/** The current camera geometry. */
	getCamera(): Camera;
	setPitch(deg: number): void;
	setYaw(deg: number): void;
	setFov(px: number): void;
	setHorizon(fraction: number): void;
	/** Nudge camera fields by deltas (re-clamped). */
	adjust(delta: Partial<Camera>): void;
	/** The current appearance (sky / fog). */
	getLook(): Look;
	setSky(color: string): void;
	setFog(density: number): void;
	setFogColor(color: string): void;
	/** Restore the camera + look to the plugin's configured defaults. */
	reset(): void;
	/** The layer ids currently rendered in 3D. */
	getTiltLayers(): readonly string[];
	/** Replace the whole set of tilted layer ids. */
	setTiltLayers(ids: readonly string[]): void;
	/** Add/remove one layer id from the tilted set. */
	toggleTiltLayer(id: string): void;
	/** Ground draw distance in canvas (world) units (`0` = unlimited). */
	getDrawDistance(): number;
	/** Set the ground draw distance in canvas units (`0` = unlimited; hides content beyond). */
	setDrawDistance(distance: number): void;
	/** Whether the flat-mode capture-frame overlay is shown. */
	isCaptureFrameVisible(): boolean;
	/** Show/hide the capture-frame overlay. */
	setCaptureFrameVisible(show: boolean): void;
	/** Flip the capture-frame overlay visibility. */
	toggleCaptureFrame(): void;
	/** The world rect captured at the last switch-on, or `null`. */
	getCaptureRect(): BoundingBox | null;
	/** Fire on any active/transition/camera/look/tilt-layer/frame change. Returns an unsubscribe. */
	onChange(listener: () => void): () => void;
}

export const mode7Service = defineService<Mode7Api>("usketch-plugin-mode7");

export function createMode7Api(store: Mode7Store, transition: Mode7Transition): Mode7Api {
	return {
		isActive: () => store.getState().active,
		enable: (opts) => transition.enable(opts),
		disable: (opts) => transition.disable(opts),
		toggle: (opts) => transition.toggle(opts),
		isTransitioning: () => transition.isTransitioning(),
		getTransitionAmount: () => store.getState().amount,
		getCamera: () => store.getState().camera,
		setPitch: (deg) => store.setCamera({ pitch: deg }),
		setYaw: (deg) => store.setCamera({ yaw: deg }),
		setFov: (px) => store.setCamera({ fov: px }),
		setHorizon: (fraction) => store.setCamera({ horizon: fraction }),
		adjust: (delta) => store.adjustCamera(delta),
		getLook: () => store.getState().look,
		setSky: (color) => store.setLook({ sky: color }),
		setFog: (density) => store.setLook({ fog: density }),
		setFogColor: (color) => store.setLook({ fogColor: color }),
		reset: () => store.reset(),
		getTiltLayers: () => store.getState().tiltLayers,
		setTiltLayers: (ids) => store.setTiltLayers(ids),
		toggleTiltLayer: (id) => store.toggleTiltLayer(id),
		getDrawDistance: () => store.getState().drawDistance,
		setDrawDistance: (distance) => store.setDrawDistance(distance),
		isCaptureFrameVisible: () => store.getState().showCaptureFrame,
		setCaptureFrameVisible: (show) => store.setCaptureFrame(show),
		toggleCaptureFrame: () => store.toggleCaptureFrame(),
		getCaptureRect: () => store.getState().captureRect,
		onChange: (listener) => store.subscribe(listener),
	};
}

/** Host accessor: `getMode7Api(app.services)?.toggle()`. Undefined when inactive. */
export function getMode7Api(services: ServiceRegistry): Mode7Api | undefined {
	return mode7Service.get(services);
}
