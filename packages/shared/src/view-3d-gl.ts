// A GPU 3D renderer's drawing hook: one WebGL2 canvas with a depth buffer draws the 3D
// view, and plugins that have their own GPU drawing (a terrain mesh) draw into it, so
// everything sorts by depth. All of them map depth the same way (see
// `VIEW3D_DEPTH_GLSL`), from `viewMatrix` (projection-3d).
import type { Mat4, View3dProjection } from "./projection-3d.js";
import { defineService } from "./service.js";
import type { ServiceRegistry } from "./types/plugin.js";

/** Depth range in px: a point's depth toward the viewer is scaled by 1 / this. */
export const VIEW3D_DEPTH_RANGE_PX = 200_000;

/**
 * GLSL (ES 3.0) for the shared depth mapping: `view3dPosition(viewMatrix * v)` is the
 * `gl_Position` of a point, with its depth toward the viewer in the depth buffer.
 */
export const VIEW3D_DEPTH_GLSL = `vec4 view3dPosition(vec4 p) {
	return vec4(p.x, p.y, clamp(-p.z / ${VIEW3D_DEPTH_RANGE_PX.toFixed(1)}, -1.0, 1.0) * p.w, p.w);
}`;

/** One frame of the 3D view, as a drawable gets it. */
export interface View3dGlFrame {
	gl: WebGL2RenderingContext;
	/** The view drawn (viewport, camera as drawn, stage size in CSS px). */
	view: View3dProjection;
	/** `viewMatrix(view)` for world points relative to (0, 0). */
	matrix: Mat4;
	/** Device px per CSS px of the canvas. */
	pixelRatio: number;
	/** How far into 3D the view is, 0 … 1. */
	amount: number;
	/** How far the ground is drawn (world units, `0` = the stage box). */
	drawDistance: number;
}

/** Something a plugin draws into the GPU 3D view with its own GL code. */
export interface View3dGlDrawable {
	id: string;
	/**
	 * Draw order: lower first (default 0). The ground is 0; a drawing with transparency
	 * goes after the solid ones.
	 */
	order?: number;
	/**
	 * Draw into the frame. The depth test is on (LEQUAL) and blending is premultiplied
	 * alpha; leave the GL state as found apart from bound objects and the program.
	 * Return `true` to be drawn again next frame (still loading, animating).
	 */
	draw(frame: View3dGlFrame): boolean | undefined;
	/** The GL context is going away (the renderer stops or loses it): free GL objects. */
	release?(gl: WebGL2RenderingContext): void;
}

/**
 * The board's GPU drawing hook for the 3D view. Plugins register their drawables at any
 * time (with or without a GPU renderer); a GPU 3D renderer draws them into its canvas and
 * says when it does, so a plugin then skips a canvas of its own.
 */
export interface View3dGlApi {
	/** Add a drawable. Returns its removal. */
	register(drawable: View3dGlDrawable): () => void;
	/** The drawables, in draw order. */
	drawables(): readonly View3dGlDrawable[];
	/** Ask for a new frame (a drawable's look changed). */
	requestFrame(): void;
	/** The renderer: told when a frame is asked for. Returns an unsubscribe. */
	onFrameRequest(listener: () => void): () => void;
	/** Whether a GPU renderer draws the 3D view (and the drawables) now. */
	isDrawing(): boolean;
	/** The renderer: whether it draws now. */
	setDrawing(on: boolean): void;
	/** Notified when the drawables or `isDrawing` change. Returns an unsubscribe. */
	subscribe(listener: () => void): () => void;
}

/** A drawing hook on its own (tests, or a host without the shared one). */
export function createView3dGl(): View3dGlApi {
	let list: View3dGlDrawable[] = [];
	let drawing = false;
	const listeners = new Set<() => void>();
	const frameListeners = new Set<() => void>();
	const notify = (): void => {
		for (const fn of [...listeners]) fn();
	};
	const sorted = (): View3dGlDrawable[] =>
		list
			.map((d, i) => ({ d, i }))
			.sort((a, b) => (a.d.order ?? 0) - (b.d.order ?? 0) || a.i - b.i)
			.map(({ d }) => d);
	let order = sorted();
	return {
		register(drawable) {
			list = [...list, drawable];
			order = sorted();
			notify();
			return () => {
				if (!list.includes(drawable)) return;
				list = list.filter((d) => d !== drawable);
				order = sorted();
				notify();
			};
		},
		drawables: () => order,
		requestFrame() {
			for (const fn of [...frameListeners]) fn();
		},
		onFrameRequest(listener) {
			frameListeners.add(listener);
			return () => {
				frameListeners.delete(listener);
			};
		},
		isDrawing: () => drawing,
		setDrawing(on) {
			if (on === drawing) return;
			drawing = on;
			notify();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

/** Typed service handle for the board's GPU drawing hook. */
export const view3dGlService = defineService<View3dGlApi>("usketch:view-3d-gl");

/** The board's GPU drawing hook, created on first use. */
export function view3dGl(services: ServiceRegistry): View3dGlApi {
	const existing = view3dGlService.get(services);
	if (existing) return existing;
	const gl = createView3dGl();
	view3dGlService.provide(services, gl);
	return gl;
}
