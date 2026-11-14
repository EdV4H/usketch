// The board's 3D view as core state: the camera a viewer looks through and how far the
// view is risen (0 = the flat board, 1 = fully 3D). Per viewer, like the viewport, and
// never synced. The heading is not part of it: turning the 3D view turns the viewport
// (`Viewport.rotation`), so everything drawn through the viewport turns with it.

/**
 * The camera of the 3D view.
 *
 * - `pitch`   … how far the ground is tilted back, degrees (0 = the flat board).
 * - `fov`     … the perspective distance in px (smaller = stronger perspective).
 * - `horizon` … the line the ground tilts about, as a fraction of the stage height.
 * - `height`  … how high the camera is, in world units (0 = the board's level). The
 *               ground at this height is drawn where the flat board would be.
 */
export interface Camera3d {
	pitch: number;
	fov: number;
	horizon: number;
	height: number;
}

export interface View3dState {
	camera: Camera3d;
	/** How far the view is risen right now, `0` (flat) … `1` (3D). Eased while it rises. */
	amount: number;
}

/** A change to {@link View3dState}: camera fields are merged, then clamped. */
export interface View3dPatch {
	camera?: Partial<Camera3d>;
	amount?: number;
}

/** Allowed camera ranges. pitch stays below 90 so the ground never goes edge-on. */
export const CAMERA_3D_LIMITS = {
	pitch: { min: 0, max: 85 },
	fov: { min: 200, max: 2000 },
	horizon: { min: 0.1, max: 0.9 },
	/** World units either way, far beyond any terrain. */
	height: { min: -100_000, max: 100_000 },
} as const;

export const DEFAULT_CAMERA_3D: Camera3d = { pitch: 55, fov: 600, horizon: 0.45, height: 0 };

export const FLAT_VIEW_3D: View3dState = { camera: DEFAULT_CAMERA_3D, amount: 0 };

function clamp(v: number, min: number, max: number, fallback = min): number {
	if (!Number.isFinite(v)) return fallback;
	return Math.min(max, Math.max(min, v));
}

/** Clamp every camera field into {@link CAMERA_3D_LIMITS} (non-finite height = 0). */
export function clampCamera3d(c: Camera3d): Camera3d {
	const l = CAMERA_3D_LIMITS;
	return {
		pitch: clamp(c.pitch, l.pitch.min, l.pitch.max),
		fov: clamp(c.fov, l.fov.min, l.fov.max),
		horizon: clamp(c.horizon, l.horizon.min, l.horizon.max),
		height: clamp(c.height, l.height.min, l.height.max, 0),
	};
}

/** Apply a patch to a state (camera merged and clamped, amount clamped to 0…1). */
export function patchView3d(state: View3dState, patch: View3dPatch): View3dState {
	const camera = patch.camera ? clampCamera3d({ ...state.camera, ...patch.camera }) : state.camera;
	const amount = patch.amount === undefined ? state.amount : clamp(patch.amount, 0, 1, 0);
	return { camera, amount };
}

/** Whether two states draw the same. */
export function sameView3d(a: View3dState, b: View3dState): boolean {
	const c = a.camera;
	const d = b.camera;
	return (
		a.amount === b.amount &&
		c.pitch === d.pitch &&
		c.fov === d.fov &&
		c.horizon === d.horizon &&
		c.height === d.height
	);
}

/** Holds a {@link View3dState} (what `BoardStore` keeps; also a stand-in for older stores). */
export interface View3dCell {
	get(): View3dState;
	/** Apply a patch. Listeners are told only when the result differs. */
	set(patch: View3dPatch): void;
	subscribe(listener: () => void): () => void;
}

export function createView3dCell(init: View3dPatch = {}): View3dCell {
	let state = patchView3d(FLAT_VIEW_3D, init);
	const listeners = new Set<() => void>();
	return {
		get: () => state,
		set(patch) {
			const next = patchView3d(state, patch);
			if (sameView3d(state, next)) return;
			state = next;
			for (const l of [...listeners]) l();
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}

/** The parts of a store that hold the 3D view (all of `BoardStore` has them). */
interface View3dHolder {
	getView3d?(): View3dState;
	setView3d?(patch: View3dPatch): void;
	subscribeView3d?(listener: () => void): () => void;
}

/**
 * The 3D view state of `store` as a cell, or `null` for a store from before it had one
 * (a host on an older `@edv4h/usketch-store`).
 */
export function view3dCellOf(store: View3dHolder): View3dCell | null {
	const { getView3d, setView3d, subscribeView3d } = store;
	if (!getView3d || !setView3d || !subscribeView3d) return null;
	return {
		get: () => getView3d.call(store),
		set: (patch) => setView3d.call(store, patch),
		subscribe: (listener) => subscribeView3d.call(store, listener),
	};
}
