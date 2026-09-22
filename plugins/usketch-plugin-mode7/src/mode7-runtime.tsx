// The Mode 7 runtime: it turns the shared store's `active`/camera state into the
// actual visual effect, without touching core coordinate math.
//   1. Injects a single <style> sheet that tilts the selected board content layers
//      into 3D — each selected layer wrapper (`[data-layer-id="…"]`) gets a
//      self-contained `perspective(fov) rotateX rotateZ`. The main container is
//      marked with a `data-mode7-stage` attribute so the rules are scoped to it (not
//      a minimap). Using a stylesheet with `!important` — rather than per-element
//      inline styles — means React can't reconcile the transform away and it applies
//      to layers that mount later, with no per-element querying or MutationObserver.
//   2. Registers the sky / fog / capture overlay layers (they self-gate on `active`).
//   3. Drives the camera position: capture-layer drag pans the viewport (move over
//      the ground) and wheel zooms — reusing the store's affine viewport.
import type { PluginContext } from "@edv4h/usketch-shared";
import { CaptureLayer, FogLayer, SkyLayer } from "./mode7-layers.js";
import type { Mode7Store } from "./mode7-store.js";
import { tiltTransform } from "./mode7-transform.js";

/** The plugin's own layer ids (never tilted). */
export const SKY_LAYER_ID = "mode7-sky";
export const FOG_LAYER_ID = "mode7-fog";
export const CAPTURE_LAYER_ID = "mode7-capture";

/** Wheel-zoom sensitivity (matches viewport-nav's deltaY-proportional feel). */
const WHEEL_ZOOM = 0.0015;

/** The main canvas container (largest area — a minimap tags one too). */
function mainContainer(): HTMLElement | null {
	if (typeof document === "undefined") return null;
	let best: HTMLElement | null = null;
	let bestArea = 0;
	for (const el of document.querySelectorAll('[data-testid="canvas-container"]')) {
		const r = (el as HTMLElement).getBoundingClientRect();
		const area = r.width * r.height;
		if (area > bestArea) {
			bestArea = area;
			best = el as HTMLElement;
		}
	}
	return best;
}

/**
 * Wire the runtime to a store. The set of tilted layers is read live from the
 * store (user-selectable via the HUD). Returns a teardown that clears every
 * injected transform, unregisters the overlay layers, and drops all listeners.
 */
export function setupMode7Runtime(ctx: PluginContext, store: Mode7Store): () => void {
	const STAGE_ATTR = "data-mode7-stage";
	let styleEl: HTMLStyleElement | null = null;

	const ensureStyleEl = (): void => {
		if (styleEl || typeof document === "undefined") return;
		styleEl = document.createElement("style");
		styleEl.setAttribute("data-mode7", "");
		document.head.appendChild(styleEl);
	};

	/** Keep an attribute-selector value valid (layer ids are simple, but be safe). */
	const attrValue = (id: string): string => id.replace(/["\\]/g, "");

	const applyTilt = (): void => {
		const container = mainContainer();
		if (!container) return;
		container.setAttribute(STAGE_ATTR, "on");
		ensureStyleEl();
		if (!styleEl) return;
		const { transform, transformOrigin } = tiltTransform(store.getState().camera);
		// `overflow:visible` + `transform-style:preserve-3d` are essential for layers
		// like `dom-shapes`: their wrapper has `overflow:hidden` (which the CSS spec
		// forces `transform-style` to `flat`) and an inner viewport-transform div that
		// Chrome composites separately — so without these the SHAPES render flat in
		// screen space while only the wrapper tilts. Overriding overflow keeps the
		// whole subtree in the 3D context; the canvas container still clips.
		// A DESCENDANT selector (space, not `>`) matches the wrapper regardless of nesting.
		const layerRules = store
			.getState()
			.tiltLayers.map(
				(id) =>
					`[${STAGE_ATTR}="on"] [data-layer-id="${attrValue(id)}"]{transform:${transform} !important;transform-origin:${transformOrigin} !important;overflow:visible !important;transform-style:preserve-3d !important;}`,
			)
			.join("");
		styleEl.textContent = layerRules;
	};

	const clearAll = (): void => {
		if (styleEl) styleEl.textContent = "";
		if (typeof document !== "undefined") {
			for (const el of document.querySelectorAll(`[${STAGE_ATTR}]`)) el.removeAttribute(STAGE_ATTR);
		}
	};

	const sync = (): void => {
		if (store.getState().active) applyTilt();
		else clearAll();
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

	// Re-sync on active / camera / tilt-layer changes.
	const unsubscribe = store.subscribe(sync);

	// Initial apply (honors enabledInitially).
	sync();

	return () => {
		clearAll();
		styleEl?.remove();
		styleEl = null;
		unsubscribe();
		ctx.layers.unregister(SKY_LAYER_ID);
		ctx.layers.unregister(FOG_LAYER_ID);
		ctx.layers.unregister(CAPTURE_LAYER_ID);
	};
}
