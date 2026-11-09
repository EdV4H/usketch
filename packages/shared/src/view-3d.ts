import { defineService } from "./service.js";

/**
 * The camera a 3D view of the board draws with right now (degrees / px). `pitch` tilts
 * the ground back (0 = straight down), `yaw` spins it, `fov` is the CSS `perspective()`
 * distance and `horizon` the pivot line as a fraction of the stage height.
 */
export interface View3dCamera {
	pitch: number;
	yaw: number;
	fov: number;
	horizon: number;
	/**
	 * Screen px the eye is raised above the board (a height × zoom, already scaled by the
	 * transition amount): everything is drawn `lift` px lower, so ground at that height
	 * shows where the flat board would. Absent = `0` (an older provider).
	 */
	lift?: number;
}

/**
 * How much of a 3D view (e.g. the Mode 7 plugin) the board is shown in right now: `0`
 * = the flat board, `1` = fully 3D, in between while the view rises / settles back. A
 * view plugin provides it; things that stand up out of the ground in 3D (raised shapes,
 * a jumping character's 2D fallback) read it so they rise and fall with the ground.
 * Absent provider = always flat.
 */
export interface View3dApi {
	/** Transition amount, `0` (flat) … `1` (3D). */
	amount(): number;
	/** The camera as drawn now (its pitch / yaw already scaled by `amount`). */
	camera(): View3dCamera;
	/**
	 * Raise the eye to `height` (world units), e.g. the ground under a followed character,
	 * so walking up a mountain doesn't climb out of the view. `0` = the board's level.
	 * Optional: a provider without it keeps the eye at the board.
	 */
	setEyeHeight?(height: number): void;
	/** Notified on every change of `amount` or the camera. Returns an unsubscribe. */
	subscribe(listener: () => void): () => void;
}

/** Typed service handle for the board's 3D view (one provider at a time). */
export const view3dService = defineService<View3dApi>("usketch:view-3d");
