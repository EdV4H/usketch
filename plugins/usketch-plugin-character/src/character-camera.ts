// The follow camera's math moved to `@edv4h/usketch-shared` (follow-view), which the
// runtime drives through `createFollowView`. The names below stay until the next major.
import {
	easeFollowFocus,
	type FollowFocus,
	type FollowViewMode,
	followRotation,
} from "@edv4h/usketch-shared";

export {
	anchorPx,
	followCameraHeight,
	followViewport,
	sameViewport,
	smoothingAlpha,
	turnedByView,
} from "@edv4h/usketch-shared";

/**
 * - `fixed`:  follow; the world stays axis-aligned (rotation 0) and the character
 *             turns on screen.
 * - `rotate`: follow AND turn the world by `-heading`, so the character always
 *             faces screen-up (racing view).
 * - `free`:   don't touch the camera.
 */
export type CameraMode = FollowViewMode | "free";

/** The smoothed camera target (= `FollowFocus`). */
export type CameraFocus = FollowFocus;

/** The camera rotation a mode wants for a heading (= `followRotation`). */
export const targetRotation: (mode: CameraMode, heading: number) => number = followRotation;

/** Ease `current` toward `target` by `alpha` (= `easeFollowFocus`). */
export const easeFocus = easeFollowFocus;

/**
 * The default `cameraHeightMargin`: the highest an ordinary jump goes (the jump's apex,
 * or the drift hop), so those never move the camera. `0` without jumping.
 */
export function defaultCameraHeightMargin(jumpHeight: number | null, hopHeight: number): number {
	return Math.max(0, jumpHeight ?? 0, hopHeight);
}
