// The Mode 7 runtime: it turns the shared store's `active`/camera state into the
// actual visual effect, without touching core coordinate math.
//   1. Injects the CSS 3D tilt (perspective+rotateX+rotateZ) onto the OUTER wrappers
//      of the board content layers (`[data-layer-id="…"]` inside the main canvas
//      container). Those wrappers' `transform` is NOT React-managed (canvas.tsx only
//      sets it on the inner viewport div), so the injection survives re-renders; a
//      MutationObserver re-applies it if the layer set changes.
//   2. Registers the sky / fog / capture overlay layers (they self-gate on `active`).
//   3. Drives the camera position: capture-layer drag pans the viewport (move over
//      the ground) and wheel zooms — reusing the store's affine viewport.
import type { PluginContext } from "@edv4h/usketch-shared";
import { CaptureLayer, FogLayer, SkyLayer } from "./mode7-layers.js";
import type { Mode7Store } from "./mode7-store.js";
import { tiltStyle } from "./mode7-transform.js";

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
	// Layer ids that currently carry an injected transform — so a layer removed from
	// the selection (or a deactivate) is cleared without touching unrelated layers.
	const applied = new Set<string>();

	const clearOne = (container: HTMLElement, id: string): void => {
		const el = container.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(id)}"]`);
		if (el) {
			el.style.transform = "";
			el.style.transformOrigin = "";
		}
	};

	const applyTilt = (): void => {
		const container = mainContainer();
		if (!container) return;
		const { transform, transformOrigin } = tiltStyle(store.getState().camera);
		const desired = store.getState().tiltLayers;
		const desiredSet = new Set(desired);
		// Clear layers that left the selection.
		for (const id of [...applied]) {
			if (!desiredSet.has(id)) {
				clearOne(container, id);
				applied.delete(id);
			}
		}
		// Apply / refresh the selected layers.
		for (const id of desired) {
			const el = container.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(id)}"]`);
			if (el) {
				el.style.transform = transform;
				el.style.transformOrigin = transformOrigin;
				applied.add(id);
			}
		}
	};

	const clearAll = (): void => {
		const container = mainContainer();
		for (const id of [...applied]) {
			if (container) clearOne(container, id);
		}
		applied.clear();
	};

	// Re-apply when the layer set changes (new/re-created wrappers lose the style).
	// Attached lazily: plugin setup runs BEFORE the Canvas mounts, so the container
	// doesn't exist yet here — it's wired the first time one is found (e.g. the first
	// toggle), not at setup.
	let observer: MutationObserver | null = null;
	const ensureObserver = (): void => {
		if (observer) return;
		const container = mainContainer();
		if (container && typeof MutationObserver !== "undefined") {
			observer = new MutationObserver(() => {
				if (store.getState().active) applyTilt();
			});
			observer.observe(container, { childList: true });
		}
	};

	const sync = (): void => {
		ensureObserver();
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

	// Re-sync on camera / active changes.
	const unsubscribe = store.subscribe(sync);

	// Initial apply (honors enabledInitially; also attaches the observer if the
	// container is already mounted).
	sync();

	return () => {
		clearAll();
		observer?.disconnect();
		unsubscribe();
		ctx.layers.unregister(SKY_LAYER_ID);
		ctx.layers.unregister(FOG_LAYER_ID);
		ctx.layers.unregister(CAPTURE_LAYER_ID);
	};
}
