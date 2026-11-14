// What a 3D view (Mode 7) asks of the board's 3D renderer, whichever draws: the CSS 3D
// renderer (tilts the DOM layers) or a GPU one (draws the 3D view on a canvas). The view
// only changes the core's 3D view state and hands over which layers show in 3D.
import { defineService } from "./service.js";

export interface View3dRendererApi {
	/** Whether it draws in 3D right now (the transition amount is above 0). */
	isDrawing(): boolean;
	/** Tilt exactly these layers, or `null` (default) for those declaring `tilt` / `depth`. */
	setTiltLayers(ids: readonly string[] | null): void;
	/** Give exactly these tilted layers depth, or `null` (default) for those declaring `depth`. */
	setDepthLayers(ids: readonly string[] | null): void;
	/** The layers tilted now. */
	getTiltLayers(): readonly string[];
	/** The tilted layers drawn with depth. */
	getDepthLayers(): readonly string[];
}

/** The board's 3D renderer (one per board). */
export const view3dRendererService = defineService<View3dRendererApi>("usketch:view-3d-renderer");
