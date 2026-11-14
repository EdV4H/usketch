// The GPU 3D renderer (experimental): draws the board's 3D view (the core `View3dState`)
// on one WebGL2 canvas with a depth buffer, instead of tilting the DOM layers like the
// CSS 3D renderer. Plugins with their own GPU drawing (the elevation's terrain) draw
// into the same canvas through the board's GL hook (`view3dGl` in shared), so the
// terrain and what stands on it hide each other by depth.
//
// While it draws, the layers that show in 3D (`tilt` / `depth`) are hidden: what they
// show is drawn on the canvas. The shapes are pictures of their (hidden) DOM drawing laid
// on the ground (see `gpu3d-shapes`). Screen layers (the sky, fog, HUD) stay DOM. It draws
// nothing while the board is flat (the 2D renderers draw it then).
import {
	boardHeight,
	createView3dTracker,
	declaredView3dShapeTypes,
	defineService,
	type Layer,
	type LayerRenderContext,
	type LayerView3d,
	type PluginContext,
	type ProjectionCamera,
	type ShapeView3d,
	sanitizeView3dShapeLimits,
	selectView3dShapes,
	type UsketchPlugin,
	type View3dCell,
	type View3dGlApi,
	type View3dGlFrame,
	type View3dRendererApi,
	type View3dState,
	view3dCellOf,
	view3dGl,
	view3dOverscanPx,
	view3dRendererService,
	view3dShapeSourceService,
	viewMatrix,
} from "@edv4h/usketch-shared";
import { useEffect, useRef } from "react";
import { type GroundLook, GroundPainter } from "./gpu3d-ground.js";
import { ShapePainter, type ShapeSource } from "./gpu3d-shapes.js";

/** The canvas layer's id. */
export const GPU3D_LAYER_ID = "gpu3d:view";
/** Attribute on the main canvas container while the GPU renderer draws. */
export const GPU_STAGE_ATTR = "data-view3d-gpu";
/** Just above the sky (Mode 7's, order 1), under every other layer. */
const LAYER_ORDER = 2;
/** The DOM renderer's shape layer (its nodes are what the shape pictures are made of). */
const DOM_SHAPES_LAYER_ID = "dom-shapes";

export type Gpu3dRendererApi = View3dRendererApi;

/** The GPU 3D renderer on `ctx.services` (one per board). */
export const gpu3dRendererService = defineService<Gpu3dRendererApi>("usketch-gpu3d-renderer");

export interface Gpu3dRendererOptions {
	/** Layers drawn in 3D instead of the declared ones. */
	tiltLayerIds?: readonly string[];
	/** Layers with depth instead of the declared ones. */
	depthLayerIds?: readonly string[];
	/** Where the 3D view state lives. Default: the board store's. */
	view3d?: View3dCell;
	/** Draw the board's shapes (default `true`). */
	shapes?: boolean;
}

/** The camera a 3D view state draws with, as the projection functions take it. Pure. */
export function drawnCamera(state: View3dState, zoom: number): ProjectionCamera {
	const a = Math.min(1, Math.max(0, state.amount));
	const { pitch, fov, horizon, height } = state.camera;
	const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
	return { pitch: pitch * a, yaw: 0, fov, horizon, heightPx: height * z * a };
}

/** The CSS that hides the layers the canvas draws instead. Pure. */
export function hiddenLayerRules(ids: readonly string[]): string {
	const stage = `[${GPU_STAGE_ATTR}="on"]`;
	const rules = ids.map(
		(id) => `${stage}>[data-layer-id="${id.replace(/["\\]/g, "")}"]{visibility:hidden !important;}`,
	);
	rules.push(`${stage} [data-view3d="hidden"]{display:none !important;}`);
	return rules.join("");
}

function declared(ctx: PluginContext, kinds: readonly LayerView3d[]): string[] {
	return ctx.layers
		.getLayers()
		.filter((l) => l.view3d !== undefined && kinds.includes(l.view3d))
		.map((l) => l.id);
}

/** The bg-grid plugin's line: #e0e0e0 at half opacity (premultiplied). */
const GRID_LINE: [number, number, number, number] = [
	(0xe0 / 255) * 0.5,
	(0xe0 / 255) * 0.5,
	(0xe0 / 255) * 0.5,
	0.5,
];
/**
 * The ground's own colour: none, as the CSS 3D renderer's tilted grid (the board's
 * background and the 3D view's sky show through between the lines, which hazes the far
 * ground the same way).
 */
const GROUND_BACKGROUND: [number, number, number, number] = [0, 0, 0, 0];

/** The GL side: one canvas, its context and what draws in it. */
class Painter {
	readonly gl: WebGL2RenderingContext;
	private ground: GroundPainter;
	private shapes: ShapePainter | null;

	static create(canvas: HTMLCanvasElement, onReady: () => void, shapes: boolean): Painter | null {
		const gl = canvas.getContext("webgl2", {
			antialias: true,
			premultipliedAlpha: true,
			alpha: true,
		});
		if (!gl) return null;
		try {
			return new Painter(gl, onReady, shapes);
		} catch (err) {
			console.error("[gpu3d-renderer] WebGL2 setup failed", err);
			return null;
		}
	}

	private constructor(gl: WebGL2RenderingContext, onReady: () => void, shapes: boolean) {
		this.gl = gl;
		this.ground = new GroundPainter(gl);
		this.shapes = shapes ? new ShapePainter(gl, onReady) : null;
	}

	/** Draw a frame; `true` when a drawable wants another. */
	draw(
		frame: Omit<View3dGlFrame, "gl">,
		look: GroundLook,
		hook: View3dGlApi,
		size: { width: number; height: number },
		shapes: ShapeSource | null,
	): boolean {
		const { gl } = this;
		const canvas = gl.canvas as HTMLCanvasElement;
		const pw = Math.max(1, Math.round(size.width * frame.pixelRatio));
		const ph = Math.max(1, Math.round(size.height * frame.pixelRatio));
		if (canvas.width !== pw || canvas.height !== ph) {
			canvas.width = pw;
			canvas.height = ph;
		}
		gl.viewport(0, 0, pw, ph);
		gl.clearColor(0, 0, 0, 0);
		gl.clearDepth(1);
		gl.depthMask(true);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		const full: View3dGlFrame = { ...frame, gl };
		this.ground.draw(full, look);
		let again = false;
		for (const d of hook.drawables()) {
			try {
				if (d.draw(full)) again = true;
			} catch (err) {
				console.error(`[gpu3d-renderer] drawable ${d.id} failed`, err);
			}
		}
		if (this.shapes && shapes && this.shapes.draw(full, shapes)) again = true;
		return again;
	}

	clear(): void {
		const { gl } = this;
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	}

	release(hook: View3dGlApi): void {
		for (const d of hook.drawables()) {
			try {
				d.release?.(this.gl);
			} catch {
				// A drawable failing to free its objects can't stop the others.
			}
		}
		this.ground.release();
		this.shapes?.release();
	}
}

/**
 * Set the renderer up on `ctx` (the plugin does it). Returns its API and teardown, or
 * `null` when the board has no 3D view state.
 */
export function setupGpu3dRenderer(
	ctx: PluginContext,
	options: Gpu3dRendererOptions = {},
): { api: Gpu3dRendererApi; dispose: () => void } | null {
	const cell = options.view3d ?? view3dCellOf(ctx.store);
	if (!cell) return null;
	const hook = view3dGl(ctx.services);
	let tiltOverride: readonly string[] | null = options.tiltLayerIds ?? null;
	let depthOverride: readonly string[] | null = options.depthLayerIds ?? null;
	const tiltLayers = (): readonly string[] => tiltOverride ?? declared(ctx, ["tilt", "depth"]);
	const depthLayers = (): readonly string[] => depthOverride ?? declared(ctx, ["depth"]);

	let canvas: HTMLCanvasElement | null = null;
	let painter: Painter | null = null;
	let raf = 0;
	let styleEl: HTMLStyleElement | null = null;
	let stage: HTMLElement | null = null;

	const drawing = (): boolean => cell.get().amount > 0 && painter !== null;
	const height = ctx.height ?? boardHeight(ctx.services);
	let rc: LayerRenderContext | null = null;

	// Which shapes stand in 3D: as the CSS 3D renderer picks them (a plugin's source, else
	// what the types declare).
	const tracker = createView3dTracker(ctx.services, ctx.events);
	const declaredTypes = declaredView3dShapeTypes(ctx.shapes, () => schedule());
	const shapes3d = (
		layerCtx: LayerRenderContext,
		stageHeight: number,
	): Map<string, ShapeView3d> => {
		const state = cell.get();
		const source = view3dShapeSourceService.get(ctx.services);
		const entries = selectView3dShapes({
			shapes: layerCtx.shapesSorted,
			types: source?.types?.() ?? declaredTypes.get(),
			viewport: layerCtx.viewport,
			viewportBounds: layerCtx.viewportBounds,
			overscanPx: view3dOverscanPx(state, layerCtx.viewport.zoom, stageHeight),
			renderMode: layerCtx.renderMode,
			amount: state.amount,
			limits: sanitizeView3dShapeLimits(source?.limits?.()),
			heightAt: (x, y) => height.groundAt(x, y),
		});
		return new Map(entries.map((e) => [e.shape.id, e.params]));
	};

	const shapeSource = (stageHeight: number): ShapeSource | null => {
		if (!rc || !stage) return null;
		const layer = stage.querySelector(`:scope > [data-layer-id="${DOM_SHAPES_LAYER_ID}"]`);
		const nodes = new Map<string, Element>();
		if (layer) {
			for (const el of layer.querySelectorAll("[data-shape-id]")) {
				const id = el.getAttribute("data-shape-id");
				if (id && !nodes.has(id)) nodes.set(id, el);
			}
		}
		return {
			shapes: rc.shapesSorted,
			registry: ctx.shapes,
			node: (id) => nodes.get(id) ?? null,
			groundAt: (x, y) => height.groundAt(x, y),
			view3d: shapes3d(rc, stageHeight),
			yaw: tracker.get().yaw,
		};
	};

	const showLayers = (on: boolean): void => {
		// The canvas sits in its layer's node, whose parent holds every layer.
		const container = canvas?.closest("[data-layer-id]")?.parentElement ?? null;
		if (stage && stage !== container) stage.removeAttribute(GPU_STAGE_ATTR);
		stage = container;
		if (!on) {
			stage?.removeAttribute(GPU_STAGE_ATTR);
			if (styleEl) styleEl.textContent = "";
			return;
		}
		if (typeof document === "undefined" || !stage) return;
		if (!styleEl) {
			styleEl = document.createElement("style");
			styleEl.setAttribute("data-gpu3d-renderer", "");
			document.head.appendChild(styleEl);
		}
		const ids = [
			...new Set([
				...tiltLayers(),
				...depthLayers(),
				...declared(ctx, ["ground"]),
				// The canvas draws itself: never hide it.
			]),
		].filter((id) => id !== GPU3D_LAYER_ID);
		const css = hiddenLayerRules(ids);
		if (styleEl.textContent !== css) styleEl.textContent = css;
		stage.setAttribute(GPU_STAGE_ATTR, "on");
	};

	const look = (): GroundLook => {
		return {
			background: GROUND_BACKGROUND,
			line: GRID_LINE,
			grid: tiltLayers().includes("bg-grid"),
			// 1 px of the flat grid (it is drawn in screen px, then tilted).
			lineWidth: 1 / (ctx.store.getViewport().zoom || 1),
		};
	};

	const frame = (): void => {
		raf = 0;
		if (!painter || !canvas) return;
		const state = cell.get();
		if (!(state.amount > 0)) {
			painter.clear();
			showLayers(false);
			hook.setDrawing(false);
			return;
		}
		showLayers(true);
		const size = { width: canvas.clientWidth, height: canvas.clientHeight };
		if (!(size.width > 0 && size.height > 0)) return;
		const viewport = ctx.store.getViewport();
		const view = { viewport, camera: drawnCamera(state, viewport.zoom), stage: size };
		const pixelRatio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
		const again = painter.draw(
			{
				view,
				matrix: viewMatrix(view),
				pixelRatio,
				amount: Math.min(1, state.amount),
				drawDistance: state.drawDistance,
			},
			look(),
			hook,
			size,
			options.shapes === false ? null : shapeSource(size.height),
		);
		hook.setDrawing(true);
		if (again) schedule();
	};

	const schedule = (): void => {
		if (raf || !painter) return;
		raf = typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(frame) : 0;
	};

	const attach = (el: HTMLCanvasElement | null): void => {
		if (el === canvas) return;
		if (painter) {
			painter.release(hook);
			painter = null;
		}
		if (raf && typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(raf);
		raf = 0;
		showLayers(false);
		hook.setDrawing(false);
		canvas = el;
		if (el) {
			painter = Painter.create(el, schedule, options.shapes !== false);
			schedule();
		}
	};

	const offs = [
		cell.subscribe(schedule),
		ctx.store.onMutation((e) => {
			if (e.type === "viewport:changed") schedule();
		}),
		hook.onFrameRequest(schedule),
		hook.subscribe(schedule),
		height.subscribe(schedule),
		// The camera's yaw, which stood-up shapes face.
		tracker.subscribe(schedule),
		ctx.events.on("layers:changed", schedule),
	];
	if (typeof window !== "undefined") window.addEventListener("resize", schedule);

	const layer: Layer = {
		id: GPU3D_LAYER_ID,
		order: LAYER_ORDER,
		avoidCollision: true,
		fixed: true,
		render: (layerCtx) => {
			// The shapes drawn next frame (the layer re-renders as the board changes).
			rc = layerCtx;
			schedule();
			return <Gpu3dCanvas attach={attach} />;
		},
	};
	ctx.layers.register(layer);

	const api: Gpu3dRendererApi = {
		isDrawing: drawing,
		setTiltLayers(ids) {
			tiltOverride = ids ? [...ids] : null;
			schedule();
		},
		setDepthLayers(ids) {
			depthOverride = ids ? [...ids] : null;
			schedule();
		},
		getTiltLayers: () => tiltLayers(),
		getDepthLayers: () => depthLayers(),
	};

	return {
		api,
		dispose: () => {
			if (ctx.layers.getLayers().some((l) => l === layer)) ctx.layers.unregister(GPU3D_LAYER_ID);
			attach(null);
			for (const off of offs) off();
			declaredTypes.dispose();
			tracker.dispose();
			if (typeof window !== "undefined") window.removeEventListener("resize", schedule);
			styleEl?.remove();
			styleEl = null;
		},
	};
}

function Gpu3dCanvas({ attach }: { attach: (el: HTMLCanvasElement | null) => void }) {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		attach(ref.current);
		return () => attach(null);
	}, [attach]);
	return (
		<canvas
			ref={ref}
			data-gpu3d-canvas=""
			style={{
				position: "absolute",
				inset: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
			}}
		/>
	);
}

/**
 * The GPU 3D renderer plugin (experimental). Add it INSTEAD of the CSS 3D renderer, before
 * the 3D view (Mode 7). If a 3D renderer is already on the board, this one does nothing.
 */
export function createGpu3dRendererPlugin(options: Gpu3dRendererOptions = {}): UsketchPlugin {
	return {
		id: "usketch-gpu3d-renderer",
		name: "GPU 3D renderer (experimental)",
		setup(ctx: PluginContext) {
			if (view3dRendererService.get(ctx.services)) return;
			const renderer = setupGpu3dRenderer(ctx, options);
			if (!renderer) return;
			const unprovide = gpu3dRendererService.provide(ctx.services, renderer.api);
			const unprovideGeneric = view3dRendererService.provide(ctx.services, renderer.api);
			return () => {
				unprovideGeneric();
				unprovide();
				renderer.dispose();
			};
		},
	};
}
