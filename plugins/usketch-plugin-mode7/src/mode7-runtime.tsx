// The Mode 7 runtime. The tilt itself is drawn by the CSS 3D renderer
// (`@edv4h/usketch-css3d-renderer`) from the board's 3D view state, which the Mode 7
// store keeps; this runtime:
//   1. Tells the renderer which layers to tilt (the HUD layer picker) and give depth.
//   2. Registers the sky / fog / capture overlay layers (they self-gate on `active`).
//   3. Drives the camera position: capture-layer drag pans the viewport (move over
//      the ground) and wheel zooms — reusing the store's affine viewport.
//   4. Turns the viewport by the camera yaw while in 3D (see `mode7-yaw.ts`).
import type { Css3dRendererApi } from "@edv4h/usketch-css3d-renderer";
import type { BoundingBox, PluginContext } from "@edv4h/usketch-shared";
import { CaptureFrameLayer, CaptureLayer, FogLayer, SkyLayer } from "./mode7-layers.js";
import { DEFAULT_DEPTH_LAYER_IDS, type Mode7State, type Mode7Store } from "./mode7-store.js";
import { createYawTurner, type YawTurner, yawPivot } from "./mode7-yaw.js";

/** The plugin's own layer ids (never tilted). */
export const SKY_LAYER_ID = "mode7-sky";
export const FOG_LAYER_ID = "mode7-fog";
export const CAPTURE_LAYER_ID = "mode7-capture";
export const CAPTURE_FRAME_LAYER_ID = "mode7-capture-frame";

/** Wheel-zoom sensitivity (matches viewport-nav's deltaY-proportional feel). */
const WHEEL_ZOOM = 0.0015;

/** Emitted with `{ active }` when the 3D stage starts / stops showing the board. */
export const STAGE_3D_EVENT = "usketch:stage-3d";

/**
 * CSS variable on the stage holding the camera height (px), set by the CSS 3D renderer.
 * @deprecated Import it from `@edv4h/usketch-css3d-renderer`.
 */
export { CAMERA_HEIGHT_VAR } from "@edv4h/usketch-css3d-renderer";

/** True when `a` and `b` differ in nothing but the camera height. */
function onlyHeightChanged(a: Mode7State, b: Mode7State): boolean {
	if (a.camera === b.camera) return false;
	for (const key of Object.keys(a) as (keyof Mode7State)[]) {
		if (key !== "camera" && a[key] !== b[key]) return false;
	}
	const c = a.camera;
	const d = b.camera;
	return (
		c.pitch === d.pitch &&
		c.yaw === d.yaw &&
		c.fov === d.fov &&
		c.horizon === d.horizon &&
		(c.height ?? 0) !== (d.height ?? 0)
	);
}

/**
 * The main canvas container (for the capture rect and the yaw pivot): the element that
 * directly wraps the board's layer divs. We locate it via `[data-layer-id]` (every layer wrapper is a direct child
 * of the container) rather than `data-testid="canvas-container"` — `data-testid` is
 * a test-only hook that the production/app build strips out, so it is absent in the
 * running app and the old selector silently matched nothing (the tilt never applied).
 * If several containers exist (e.g. a minimap that also renders layers), the largest
 * by area wins.
 */
function mainContainer(): HTMLElement | null {
	if (typeof document === "undefined") return null;
	let best: HTMLElement | null = null;
	let bestArea = 0;
	const seen = new Set<HTMLElement>();
	for (const el of document.querySelectorAll("[data-layer-id]")) {
		const parent = (el as HTMLElement).parentElement;
		if (!parent || seen.has(parent)) continue;
		seen.add(parent);
		const r = parent.getBoundingClientRect();
		const area = r.width * r.height;
		if (area > bestArea) {
			bestArea = area;
			best = parent;
		}
	}
	return best;
}

/**
 * Wire the runtime to a store. The set of tilted layers is read live from the
 * store (user-selectable via the HUD). Returns a teardown that clears every
 * injected transform, unregisters the overlay layers, and drops all listeners.
 */
export function setupMode7Runtime(
	ctx: PluginContext,
	store: Mode7Store,
	options: {
		/** Draws the tilted layers (Mode 7 only tells it which ones). */
		renderer: Css3dRendererApi;
		depthLayerIds?: readonly string[];
		/** Turns the viewport by the yaw (default: one of its own on `ctx.store`). */
		yaw?: YawTurner;
		/**
		 * Tilt layers that declare it (`Layer.view3d` `tilt` / `depth`) as well: each is
		 * added to the tilted set the first time it is seen (so the picker can still take
		 * it out). Off when the host gave its own `tiltLayerIds`.
		 */
		adoptDeclared?: boolean;
		/** Layers never tilted, even when they declare it. */
		excludedLayerIds?: readonly string[];
	},
): () => void {
	const { renderer } = options;
	const excluded = new Set(options.excludedLayerIds ?? []);
	// Layers declared `depth` keep their depth unless the host listed the depth layers.
	const depthLayers = (): ReadonlySet<string> => {
		if (options.depthLayerIds) return new Set(options.depthLayerIds);
		const ids = new Set(DEFAULT_DEPTH_LAYER_IDS);
		for (const layer of ctx.layers.getLayers()) {
			if (layer.view3d === "depth") ids.add(layer.id);
		}
		return ids;
	};
	// Layers declared `tilt` / `depth` join the tilted set once, when first seen.
	const seenDeclared = new Set<string>();
	const adoptDeclared = (): void => {
		if (!options.adoptDeclared) return;
		const current = store.getState().tiltLayers;
		const add: string[] = [];
		for (const layer of ctx.layers.getLayers()) {
			if (layer.view3d !== "tilt" && layer.view3d !== "depth") continue;
			if (seenDeclared.has(layer.id) || excluded.has(layer.id)) continue;
			seenDeclared.add(layer.id);
			if (!current.includes(layer.id)) add.push(layer.id);
		}
		if (add.length > 0) store.setTiltLayers([...current, ...add]);
	};
	// Tell ground plugins when the 3D stage starts / stops showing the board (the map
	// builds its raised relief only then). A plain event.
	let lastStage = false;
	const announceStage = (active: boolean): void => {
		if (active === lastStage) return;
		lastStage = active;
		ctx.events.emit(STAGE_3D_EVENT, { active });
	};

	// The renderer tilts the layers in Mode 7's picker (and its depth layers).
	let pushedTilt: readonly string[] | null = null;
	let pushedDepth = "";
	const pushLayers = (): void => {
		const tilt = store.getState().tiltLayers;
		if (tilt !== pushedTilt) {
			pushedTilt = tilt;
			renderer.setTiltLayers(tilt);
		}
		const depth = [...depthLayers()];
		const key = depth.join("\n");
		if (key !== pushedDepth) {
			pushedDepth = key;
			renderer.setDepthLayers(depth);
		}
	};

	/**
	 * The current viewport as a WORLD rectangle (== `LayerRenderContext.viewportBounds`,
	 * recomputed here because the runtime has no render ctx): screen box [0,0,W,H]
	 * inverted through the affine viewport (`world = (screen - vp) / zoom`).
	 */
	const viewportWorldRect = (): BoundingBox | null => {
		const c = mainContainer();
		if (!c) return null;
		const r = c.getBoundingClientRect();
		const vp = ctx.store.getViewport();
		if (!vp.zoom || r.width <= 0 || r.height <= 0) return null;
		return {
			x: -vp.x / vp.zoom,
			y: -vp.y / vp.zoom,
			width: r.width / vp.zoom,
			height: r.height / vp.zoom,
		};
	};

	// Snapshot the capture rect when the view is switched ON (the frame then shows
	// "what the 3D ground covered" back in flat mode), and seed it the first time the
	// overlay is switched on with nothing captured yet.
	let prevActive = false;
	const maybeCapture = (): void => {
		const st = store.getState();
		const rising = st.active && !prevActive;
		// Update the edge tracker BEFORE setCaptureRect — it notifies synchronously and
		// re-enters sync()/maybeCapture(), so a stale `prevActive` would loop forever.
		prevActive = st.active;
		if (rising || (st.showCaptureFrame && !st.captureRect)) {
			const rect = viewportWorldRect();
			if (rect) store.setCaptureRect(rect);
		}
	};

	// Turn the viewport by the yaw (scaled by the transition) about the tilt's pivot.
	const yaw = options.yaw ?? createYawTurner(ctx.store);
	const pivot = () => {
		const c = mainContainer();
		if (!c) return null;
		const r = c.getBoundingClientRect();
		if (r.width <= 0 || r.height <= 0) return null;
		return yawPivot(r, store.getState().camera.horizon);
	};
	const turnYaw = (): void => {
		const { camera, amount } = store.getState();
		yaw.sync(camera.yaw, amount, pivot);
	};

	const sync = (): void => {
		const active = store.getState().active;
		// Entering 3D: take in layers declared since setup.
		if (active && !lastStage) adoptDeclared();
		turnYaw();
		pushLayers();
		announceStage(active);
		maybeCapture();
	};

	// Camera drive from the capture layer (reuse the affine viewport).
	const handlers = {
		onPan: (dx: number, dy: number) => ctx.store.panBy(dx, dy),
		onZoom: (deltaY: number, center: { x: number; y: number }) => {
			const factor = Math.exp(-deltaY * WHEEL_ZOOM);
			ctx.store.zoomTo(ctx.store.getViewport().zoom * factor, center);
		},
	};

	// Register the three overlay layers once; they self-hide when inactive.
	ctx.layers.register({
		id: SKY_LAYER_ID,
		order: 1,
		fixed: true,
		render: () => <SkyLayer store={store} />,
	});
	ctx.layers.register({
		id: FOG_LAYER_ID,
		order: 9000,
		fixed: true,
		render: () => <FogLayer store={store} />,
	});
	ctx.layers.register({
		id: CAPTURE_LAYER_ID,
		order: 9500,
		fixed: true,
		render: () => <CaptureLayer store={store} handlers={handlers} />,
	});
	// The capture-frame overlay is NON-fixed (world-anchored via the viewport
	// transform) so it pans/zooms with the board; it self-hides unless flat + toggled.
	ctx.layers.register({
		id: CAPTURE_FRAME_LAYER_ID,
		order: 8000,
		render: (rc) => <CaptureFrameLayer store={store} zoom={rc.viewport.zoom} />,
	});

	// Re-sync on active / camera / tilt-layer changes. A camera-height change alone (every
	// frame while a follower climbs) is the renderer's alone.
	let prevState = store.getState();
	const unsubscribe = store.subscribe(() => {
		const next = store.getState();
		const liftOnly = onlyHeightChanged(prevState, next);
		prevState = next;
		if (!liftOnly) sync();
	});

	adoptDeclared();
	// Initial apply (honors enabledInitially). The stage may not be laid out yet: turn by
	// the yaw once more on the next frame.
	sync();
	const retry =
		typeof requestAnimationFrame === "function"
			? requestAnimationFrame(() => {
					adoptDeclared();
					turnYaw();
				})
			: null;
	// Layers registered later (plugins announce them with `layers:changed`).
	const offLayers = ctx.events.on("layers:changed", () => {
		adoptDeclared();
		pushLayers();
	});

	return () => {
		if (retry !== null) cancelAnimationFrame(retry);
		offLayers();
		yaw.restore(pivot);
		announceStage(false);
		unsubscribe();
		renderer.setTiltLayers(null);
		renderer.setDepthLayers(null);
		ctx.layers.unregister(SKY_LAYER_ID);
		ctx.layers.unregister(FOG_LAYER_ID);
		ctx.layers.unregister(CAPTURE_LAYER_ID);
		ctx.layers.unregister(CAPTURE_FRAME_LAYER_ID);
	};
}
