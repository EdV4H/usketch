// Host-facing API on the `ctx.services` seam (same convention as dashboard/window-
// system): thin, typed delegation to the reactive store so a host or another plugin
// can drive the Mode 7 view without the HUD.
import {
	type BoundingBox,
	defineService,
	type ServiceRegistry,
	type View3dApi,
} from "@edv4h/usketch-shared";
import { type Camera, cameraHeightPx, type RenderedCamera } from "./mode7-camera.js";
import type { HeightKeyConfig, HeightKeys } from "./mode7-height-keys.js";
import type { Look, Mode7Store } from "./mode7-store.js";
import { tiltCamera } from "./mode7-transform.js";
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
	/** The current camera geometry (the target; see `getRenderedCamera` mid-transition). */
	getCamera(): Camera;
	/**
	 * The camera as drawn right now: `getCamera()` with pitch scaled by the transition
	 * amount (flat when off), plus its height in screen px (`heightPx`). Its `yaw` is `0`:
	 * the yaw turns the viewport instead. Feed it to `projectToGround` /
	 * `unprojectFromGround` (with screen points through the viewport) to line things up
	 * with the ground.
	 */
	getRenderedCamera(): RenderedCamera;
	setPitch(deg: number): void;
	/**
	 * Turn the view to heading `deg`. While in 3D the viewport is turned (about the
	 * horizon point) by the yaw, and turned back when the view goes flat again.
	 */
	setYaw(deg: number): void;
	setFov(px: number): void;
	setHorizon(fraction: number): void;
	/**
	 * Raise the camera to `height` world units (`0` = the board's level): the ground at
	 * that height is drawn where the flat board would be, so following something up a
	 * mountain keeps it in view. A follower sets it every frame (ease it yourself).
	 */
	setHeight(height: number): void;
	/**
	 * The keys that raise / lower the camera while held (`KeyboardEvent.code`), or `null` (off).
	 * @deprecated Read the keymap: `keymap.getKeys(HEIGHT_KEY_IDS.up)` / `.down`.
	 */
	getHeightKeys(): HeightKeys | null;
	/**
	 * Rebind the height keys; `null` turns them off. With a keymap this rebinds its
	 * bindings for the viewer.
	 * @deprecated Use the keymap: `keymap.setKeys(HEIGHT_KEY_IDS.up, codes)`, or the host's
	 * `createApp({ keymap: { keys } })`.
	 */
	setHeightKeys(keys: HeightKeys | null): void;
	/** How fast the height keys move the camera, screen px per second. */
	getHeightSpeed(): number;
	setHeightSpeed(pxPerSecond: number): void;
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

/** The camera as drawn now: the transition-scaled camera plus its height in px. */
export function renderedCamera(store: Mode7Store, zoom: number): RenderedCamera {
	const { camera, amount } = store.getState();
	return {
		...tiltCamera(camera, amount),
		heightPx: cameraHeightPx(camera.height, zoom, amount),
	};
}

/** `zoom` reads the board's current zoom (the camera height is in world units). */
export function createMode7Api(
	store: Mode7Store,
	transition: Mode7Transition,
	zoom: () => number = () => 1,
	heightKeys: HeightKeyConfig = { keys: null, speed: 0 },
): Mode7Api {
	return {
		isActive: () => store.getState().active,
		enable: (opts) => transition.enable(opts),
		disable: (opts) => transition.disable(opts),
		toggle: (opts) => transition.toggle(opts),
		isTransitioning: () => transition.isTransitioning(),
		getTransitionAmount: () => store.getState().amount,
		getCamera: () => store.getState().camera,
		getRenderedCamera: () => renderedCamera(store, zoom()),
		setPitch: (deg) => store.setCamera({ pitch: deg }),
		setYaw: (deg) => store.setCamera({ yaw: deg }),
		setFov: (px) => store.setCamera({ fov: px }),
		setHorizon: (fraction) => store.setCamera({ horizon: fraction }),
		setHeight: (height) => store.setCamera({ height }),
		getHeightKeys: () => heightKeys.keys,
		setHeightKeys: (keys) => {
			if (heightKeys.rebind) heightKeys.rebind(keys);
			else heightKeys.keys = keys ? { up: [...keys.up], down: [...keys.down] } : null;
		},
		getHeightSpeed: () => heightKeys.speed,
		setHeightSpeed: (pxPerSecond) => {
			if (Number.isFinite(pxPerSecond) && pxPerSecond >= 0) heightKeys.speed = pxPerSecond;
		},
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

/**
 * The generic 3D-view state (`view3dService` in shared) backed by this store, so
 * plugins that rise out of the ground in 3D follow the view without depending on Mode 7.
 */
export function createView3dApi(
	store: Mode7Store,
	zoom: () => number = () => 1,
	/** Told whenever a follower sets the height, so the height keys yield to it. */
	onDriveHeight: () => void = () => {},
	/** How far the yaw has turned the viewport now (see `mode7-yaw.ts`). */
	turn: () => number = () => 0,
): View3dApi {
	return {
		amount: () => store.getState().amount,
		camera: () => {
			const c = renderedCamera(store, zoom());
			return { pitch: c.pitch, yaw: c.yaw, fov: c.fov, horizon: c.horizon, heightPx: c.heightPx };
		},
		setCameraHeight: (height) => {
			onDriveHeight();
			store.setCamera({ height });
		},
		turn,
		subscribe: (listener) => store.subscribe(listener),
	};
}
