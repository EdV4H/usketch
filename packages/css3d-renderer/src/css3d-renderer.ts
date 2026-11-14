// The CSS 3D renderer: draws the board's 3D view (the core `View3dState`) by tilting the
// canvas's own layer wrappers with CSS 3D transforms. It pairs with the DOM renderer: the
// shapes stay the 2D DOM, only their layers are turned into a receding ground plane, and
// shapes with a 3D look stand out of it in a layer of its own (see css3d-shapes).
//
// One injected <style> sheet (`!important` rules, scoped to the main canvas container
// marked with a stage attribute) tilts each layer that shows in 3D:
//   - `tilt`  layers get `perspective() rotateX()` about the horizon and the draw-distance
//             `clip-path`;
//   - `depth` layers get the same tilt without the clip (a clip flattens 3D), and keep the
//             3D context through the canvas's inner wrappers, so what they draw can rise
//             out of the ground;
//   - `hidden` layers aren't shown.
// A stylesheet (rather than inline styles) survives React re-renders and applies to layers
// that mount later. The camera height lowers every tilted layer through one CSS variable,
// so a follower can move it every frame without rewriting the sheet.
import {
	boardHeight,
	defineService,
	isOccluded,
	type LayerView3d,
	type PluginContext,
	type ProjectionCamera,
	type StageSize,
	tiltCss,
	type UsketchPlugin,
	type View3dCell,
	type View3dOcclusionApi,
	type View3dProjection,
	type View3dRendererApi,
	type View3dState,
	view3dCellOf,
	view3dOcclusionService,
	view3dRendererService,
} from "@edv4h/usketch-shared";
import {
	depthStageRules,
	drawDistanceClip,
	drawDistanceOverscanPx,
	tiltLayerRules,
} from "./css3d-css.js";
import { setupCss3dShapes } from "./css3d-shapes.js";

/** Attribute the renderer puts on the main canvas container while drawing in 3D. */
export const STAGE_ATTR = "data-view3d-stage";
/** The attribute Mode 7 used to set; still set (some plugins look for it) until the next major. */
export const LEGACY_STAGE_ATTR = "data-mode7-stage";
/** CSS variable on the stage holding the camera height (px); the tilt lowers every layer by it. */
export const CAMERA_HEIGHT_VAR = "--usketch-mode7-camera-height";
/** Extra px added to the grid overscan event so it comfortably covers the clip line. */
const OVERSCAN_BUFFER = 16;

export interface Css3dRendererApi extends View3dRendererApi {
	/** Whether the board is being drawn in 3D now (the view's amount is above 0). */
	isDrawing(): boolean;
	/**
	 * Tilt exactly these layers, or `null` (default) for the layers that declare
	 * `view3d: "tilt" | "depth"`. A 3D view with its own layer picker (Mode 7) sets it.
	 */
	setTiltLayers(ids: readonly string[] | null): void;
	/** Give exactly these tilted layers depth, or `null` (default) for those declaring `depth`. */
	setDepthLayers(ids: readonly string[] | null): void;
	/** The layers tilted now (as resolved from the declarations or the set lists). */
	getTiltLayers(): readonly string[];
	/** The tilted layers drawn with depth. */
	getDepthLayers(): readonly string[];
	/**
	 * Sort the layers' 3D contents by their real depth in one 3D space (experimental, off
	 * by default): see `depthStageRules`.
	 */
	setDepthStage(on: boolean): void;
	isDepthStage(): boolean;
	/**
	 * How standing things (3D shapes, characters) behind the ground (a hill, a cliff) are
	 * drawn: faded (default), not drawn, or as if nothing hid them (`none`).
	 */
	setOcclusion(mode: Css3dOcclusionMode): void;
	getOcclusion(): Css3dOcclusionMode;
}

/** See {@link Css3dRendererApi.setOcclusion}. */
export type Css3dOcclusionMode = "fade" | "hide" | "none";

const OCCLUSION_MODES: readonly Css3dOcclusionMode[] = ["fade", "hide", "none"];

/** The renderer on `ctx.services` (one per board). */
export const css3dRendererService = defineService<Css3dRendererApi>("usketch-css3d-renderer");

export interface Css3dRendererOptions {
	/** Layers to tilt instead of the declared ones (see {@link Css3dRendererApi.setTiltLayers}). */
	tiltLayerIds?: readonly string[];
	/** Layers to give depth instead of the declared ones. */
	depthLayerIds?: readonly string[];
	/**
	 * Where the 3D view state lives. Default: the board store's (`BoardStore.getView3d`);
	 * a host on an older store passes a cell of its own.
	 */
	view3d?: View3dCell;
	/** Draw the shapes that have a 3D look (see css3d-shapes). Default `true`. */
	shapes?: boolean;
	/** Start with the depth stage on (see {@link Css3dRendererApi.setDepthStage}). Default `false`. */
	depthStage?: boolean;
	/** Offer the renderer's settings on the HUD. Default `true`. */
	hud?: boolean;
	/** How things behind the ground are drawn (see {@link Css3dRendererApi.setOcclusion}). Default `"fade"`. */
	occlusion?: Css3dOcclusionMode;
}

/** The camera a tilted layer is drawn with, as the projection functions take it. Pure. */
export function projectionCamera(state: View3dState, zoom: number): ProjectionCamera {
	const a = Math.min(1, Math.max(0, state.amount));
	const { pitch, fov, horizon } = state.camera;
	return { pitch: pitch * a, yaw: 0, fov, horizon, heightPx: cameraHeightPx(state, zoom) };
}

/** The layer ids that declare one of `kinds`, in drawing order. */
function declared(ctx: PluginContext, kinds: readonly LayerView3d[]): string[] {
	return ctx.layers
		.getLayers()
		.filter((l) => l.view3d !== undefined && kinds.includes(l.view3d))
		.map((l) => l.id);
}

/** The camera height in screen px as drawn: height × zoom, faded with the amount. */
export function cameraHeightPx(state: View3dState, zoom: number): number {
	const a = Math.min(1, Math.max(0, state.amount));
	const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
	return Math.round(state.camera.height * z * a * 100) / 100;
}

/** The transform of a tilted layer: the camera's tilt, lowered by the camera height. */
export function layerTransform(state: View3dState): { transform: string; transformOrigin: string } {
	const a = Math.min(1, Math.max(0, state.amount));
	const { pitch, fov, horizon } = state.camera;
	const tilt = tiltCss({ pitch: pitch * a, yaw: 0, fov, horizon });
	return {
		transform: `${tilt.transform} translateZ(calc(var(${CAMERA_HEIGHT_VAR}, 0px) * -1))`,
		transformOrigin: tilt.transformOrigin,
	};
}

/**
 * The main canvas container: the element that directly wraps the board's layer divs
 * (found through `[data-layer-id]`, since `data-testid` is stripped from app builds). If
 * several exist (e.g. a minimap that also renders layers), the largest wins.
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
 * Set up the renderer on `ctx`: draws whenever the 3D view's amount is above 0. Returns
 * its API and a teardown that clears every injected rule.
 */
export function setupCss3dRenderer(
	ctx: PluginContext,
	options: Css3dRendererOptions = {},
): { api: Css3dRendererApi; dispose: () => void } | null {
	const cell = options.view3d ?? view3dCellOf(ctx.store);
	if (!cell) return null;
	let tiltOverride: readonly string[] | null = options.tiltLayerIds ?? null;
	let depthStage = options.depthStage === true;
	// Notified when a HUD setting changes.
	const settingsListeners = new Set<() => void>();
	let occlusionMode: Css3dOcclusionMode = OCCLUSION_MODES.includes(
		options.occlusion as Css3dOcclusionMode,
	)
		? (options.occlusion as Css3dOcclusionMode)
		: "fade";
	// The stage's size as last measured (by `draw`), for the occlusion's projection.
	let stageSize: StageSize | null = null;
	// The stage's parent clips while the depth stage leaves the stage unclipped: its own
	// inline `overflow`, to put back.
	let clippedParent: { el: HTMLElement; overflow: string } | null = null;
	const clipParent = (container: HTMLElement | null): void => {
		const parent = container?.parentElement ?? null;
		if (clippedParent && clippedParent.el !== parent) {
			clippedParent.el.style.overflow = clippedParent.overflow;
			clippedParent = null;
		}
		if (!parent || clippedParent) return;
		clippedParent = { el: parent, overflow: parent.style.overflow };
		parent.style.overflow = "clip";
	};
	const unclipParent = (): void => {
		if (!clippedParent) return;
		clippedParent.el.style.overflow = clippedParent.overflow;
		clippedParent = null;
	};
	let depthOverride: readonly string[] | null = options.depthLayerIds ?? null;

	const tiltLayers = (): readonly string[] => tiltOverride ?? declared(ctx, ["tilt", "depth"]);
	const depthLayers = (): readonly string[] => depthOverride ?? declared(ctx, ["depth"]);

	let styleEl: HTMLStyleElement | null = null;
	// Rewriting a <style> with the same text still restyles the stage: skip identical text.
	let lastCss = "";
	let stage: HTMLElement | null = null;
	let lastLift = "";
	let lastOverscan = -1;

	// Older backgrounds extend under the far ground through this event (newer ones read
	// `LayerRenderContext.view3dOverscan`). Removed at the next major.
	const driveGridOverscan = (px: number): void => {
		if (px === lastOverscan) return;
		lastOverscan = px;
		ctx.events.emit("bg-grid:set-overscan", { px });
	};

	const ensureStyleEl = (): HTMLStyleElement | null => {
		if (styleEl || typeof document === "undefined") return styleEl;
		styleEl = document.createElement("style");
		styleEl.setAttribute("data-css3d-renderer", "");
		document.head.appendChild(styleEl);
		return styleEl;
	};

	const applyLift = (container: HTMLElement | null = stage): void => {
		if (!container) return;
		const value = `${cameraHeightPx(cell.get(), ctx.store.getViewport().zoom)}px`;
		if (value === lastLift && container === stage) return;
		lastLift = value;
		container.style.setProperty(CAMERA_HEIGHT_VAR, value);
	};

	// A ground layer only covers the layers under it while it draws something: watch what
	// is inside its wrapper (the canvas wraps the layer's drawing in one more element, empty
	// while the layer renders nothing) and redraw when that changes.
	let groundWatch: MutationObserver | null = null;
	const watched = new Set<Element>();
	const drawsGround = (container: HTMLElement, id: string): boolean => {
		const el = [...container.children].find((c) => c.getAttribute("data-layer-id") === id);
		if (!el) return false;
		if (!watched.has(el) && typeof MutationObserver !== "undefined") {
			groundWatch ??= new MutationObserver(() => {
				if (drawing()) draw();
			});
			groundWatch.observe(el, { childList: true, subtree: true });
			watched.add(el);
		}
		return el.querySelector(":scope > * > *") !== null;
	};
	const unwatchGround = (): void => {
		groundWatch?.disconnect();
		groundWatch = null;
		watched.clear();
	};

	const draw = (): void => {
		const container = mainContainer();
		if (!container) return;
		container.setAttribute(STAGE_ATTR, "on");
		container.setAttribute(LEGACY_STAGE_ATTR, "on");
		if (container !== stage) {
			stage?.style.removeProperty(CAMERA_HEIGHT_VAR);
			lastLift = "";
		}
		applyLift(container);
		stage = container;
		const sheet = ensureStyleEl();
		if (!sheet) return;
		const state = cell.get();
		const { transform, transformOrigin } = layerTransform(state);
		// The clip is in world units → px through the zoom and the stage height.
		const zoom = ctx.store.getViewport().zoom;
		const rect = container.getBoundingClientRect();
		const heightPx = rect.height;
		stageSize = { width: rect.width, height: rect.height };
		const clip = drawDistanceClip(state.drawDistance, zoom, heightPx, state.amount);
		const overscan = drawDistanceOverscanPx(state.drawDistance, zoom, heightPx);
		driveGridOverscan(overscan > 0 ? overscan + OVERSCAN_BUFFER : 0);
		const rules = tiltLayerRules(tiltLayers(), {
			stageAttr: STAGE_ATTR,
			transform,
			transformOrigin,
			clip,
			depthLayerIds: new Set(depthLayers()),
		});
		let stageRules = "";
		if (depthStage) {
			const tilted = new Set(tiltLayers());
			stageRules = depthStageRules({
				stageAttr: STAGE_ATTR,
				layers: ctx.layers.getLayers().map((l) => ({
					id: l.id,
					tilted: tilted.has(l.id),
					ground: l.view3d === "ground" && drawsGround(container, l.id),
				})),
				background: container.style.background || "transparent",
				tiltTransform: transform,
			});
			clipParent(container);
		} else {
			unclipParent();
			unwatchGround();
		}
		const css = `${rules}${stageRules}[${STAGE_ATTR}="on"] [data-view3d="hidden"]{display:none !important;}`;
		if (css === lastCss) return;
		lastCss = css;
		sheet.textContent = css;
	};

	const clear = (): void => {
		unclipParent();
		unwatchGround();
		if (styleEl) styleEl.textContent = "";
		lastCss = "";
		stage?.style.removeProperty(CAMERA_HEIGHT_VAR);
		stage = null;
		lastLift = "";
		if (typeof document !== "undefined") {
			for (const el of document.querySelectorAll(`[${STAGE_ATTR}]`)) {
				el.removeAttribute(STAGE_ATTR);
				el.removeAttribute(LEGACY_STAGE_ATTR);
			}
		}
		driveGridOverscan(0);
	};

	const drawing = (): boolean => cell.get().amount > 0;
	const sync = (): void => {
		if (drawing()) draw();
		else clear();
	};

	// A change of the camera height alone (every frame while a follower climbs) only
	// moves the stage's height variable.
	let prev = cell.get();
	const offCell = cell.subscribe(() => {
		const next = cell.get();
		const c = prev.camera;
		const d = next.camera;
		const liftOnly =
			next.amount === prev.amount &&
			next.drawDistance === prev.drawDistance &&
			c.pitch === d.pitch &&
			c.fov === d.fov &&
			c.horizon === d.horizon;
		prev = next;
		if (liftOnly && drawing() && stage?.isConnected) applyLift();
		else sync();
	});

	// The clip depends on the zoom and the stage height; a pan changes neither (and
	// re-drawing on it would restyle the stage every frame a camera follows something).
	let lastZoom = ctx.store.getViewport().zoom;
	const offViewport = ctx.store.onMutation((e) => {
		if (e.type !== "viewport:changed") return;
		const zoom = ctx.store.getViewport().zoom;
		if (zoom === lastZoom) return;
		lastZoom = zoom;
		if (drawing()) draw();
	});
	const onResize = (): void => {
		if (drawing()) draw();
	};
	if (typeof window !== "undefined") window.addEventListener("resize", onResize);
	// Layers added later may declare how they show in 3D.
	const offLayers = ctx.events.on("layers:changed", onResize);

	sync();

	// What the ground hides: the terrain mesh is a canvas the browser can't sort against
	// the standing things, so they ask (see `View3dOcclusionApi`).
	const height = () => ctx.height ?? boardHeight(ctx.services);
	const groundAt = (x: number, y: number): number => height().groundAt(x, y);
	const projection = (): View3dProjection | null => {
		const state = cell.get();
		if (!(state.amount > 0) || !stageSize || !(stageSize.width > 0)) return null;
		const viewport = ctx.store.getViewport();
		return { viewport, camera: projectionCamera(state, viewport.zoom), stage: stageSize };
	};
	const occlusion: View3dOcclusionApi = {
		hidden(x, y, h) {
			if (occlusionMode === "none") return false;
			const view = projection();
			if (!view || !(view.camera.pitch > 0)) return false;
			return isOccluded({ x, y, height: h }, view, groundAt);
		},
		look: () => (occlusionMode === "hide" ? "hide" : "fade"),
		subscribe(listener) {
			settingsListeners.add(listener);
			const offState = cell.subscribe(listener);
			const offHeight = height().subscribe(listener);
			return () => {
				settingsListeners.delete(listener);
				offState();
				offHeight();
			};
		},
	};
	const unprovideOcclusion = view3dOcclusionService.get(ctx.services)
		? null
		: view3dOcclusionService.provide(ctx.services, occlusion);
	const disposeShapes =
		options.shapes === false ? null : setupCss3dShapes(ctx, { occlusion: () => occlusion });

	const api: Css3dRendererApi = {
		isDrawing: drawing,
		setTiltLayers(ids) {
			tiltOverride = ids ? [...ids] : null;
			sync();
		},
		setDepthLayers(ids) {
			depthOverride = ids ? [...ids] : null;
			sync();
		},
		getTiltLayers: () => tiltLayers(),
		getDepthLayers: () => depthLayers(),
		setDepthStage(on) {
			if (on === depthStage) return;
			depthStage = on;
			sync();
			for (const fn of [...settingsListeners]) fn();
		},
		isDepthStage: () => depthStage,
		setOcclusion(mode) {
			if (!OCCLUSION_MODES.includes(mode) || mode === occlusionMode) return;
			occlusionMode = mode;
			for (const fn of [...settingsListeners]) fn();
		},
		getOcclusion: () => occlusionMode,
	};

	const unregisterHud =
		options.hud === false || !ctx.hud
			? null
			: registerCss3dRendererHud(ctx, api, settingsListeners);

	return {
		api,
		dispose: () => {
			unregisterHud?.();
			unprovideOcclusion?.();
			settingsListeners.clear();
			disposeShapes?.();
			clear();
			styleEl?.remove();
			styleEl = null;
			offCell();
			offViewport();
			offLayers();
			if (typeof window !== "undefined") window.removeEventListener("resize", onResize);
		},
	};
}

/** HUD field name of the depth stage toggle. */
export const DEPTH_STAGE_FIELD = "depthStage";
/** HUD field name of the occlusion choice. */
export const OCCLUSION_FIELD = "occlusion";

/** The renderer's HUD settings. Returns the unregister. */
function registerCss3dRendererHud(
	ctx: PluginContext,
	api: Css3dRendererApi,
	listeners: Set<() => void>,
): () => void {
	return ctx.hud.registerSettings({
		id: "usketch-css3d-renderer:settings",
		label: "3D の描き方（CSS 3D）",
		order: 15,
		fields: [
			{
				name: OCCLUSION_FIELD,
				label: "地形の陰",
				type: "enum",
				options: [
					{ value: "fade", label: "薄くする" },
					{ value: "hide", label: "隠す" },
					{ value: "none", label: "そのまま" },
				],
			},
			{ name: DEPTH_STAGE_FIELD, label: "奥行きで重ねる（実験）", type: "boolean" },
		],
		get: (name) => {
			if (name === DEPTH_STAGE_FIELD) return api.isDepthStage();
			if (name === OCCLUSION_FIELD) return api.getOcclusion();
			return undefined;
		},
		set: (name, value) => {
			if (name === DEPTH_STAGE_FIELD) api.setDepthStage(value === true);
			if (name === OCCLUSION_FIELD) api.setOcclusion(value as Css3dOcclusionMode);
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	});
}

/**
 * The CSS 3D renderer plugin. Add it next to the DOM renderer; a 3D view (Mode 7) then
 * only changes the core's 3D view state. If a renderer is already on the board (Mode 7
 * adds one when the host didn't), this one does nothing.
 */
export function createCss3dRendererPlugin(options: Css3dRendererOptions = {}): UsketchPlugin {
	return {
		id: "usketch-css3d-renderer",
		name: "CSS 3D renderer",
		setup(ctx: PluginContext) {
			// Another 3D renderer (a CSS 3D one, or a GPU one) already draws the board.
			if (css3dRendererService.get(ctx.services) || view3dRendererService.get(ctx.services)) return;
			const renderer = setupCss3dRenderer(ctx, options);
			if (!renderer) return;
			const unprovide = css3dRendererService.provide(ctx.services, renderer.api);
			// The generic 3D renderer slot too, unless a GPU renderer took it.
			const unprovideGeneric = view3dRendererService.get(ctx.services)
				? null
				: view3dRendererService.provide(ctx.services, renderer.api);
			return () => {
				unprovideGeneric?.();
				unprovide();
				renderer.dispose();
			};
		},
	};
}
