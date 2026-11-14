// Point math for the Mode 7 tilt: where a point of the flat canvas ends up on screen,
// and back. The math lives in `@edv4h/usketch-shared` (`projectStagePoint` /
// `unprojectStagePoint`, plus world-coordinate versions, `unprojectOnGround` and a
// `viewMatrix` for shaders) so every renderer and plugin uses one copy. These are the
// names this plugin has exported since #1248.
import { projectStagePoint, unprojectStagePoint } from "@edv4h/usketch-shared";

export type { GroundProjection, ProjectionCamera, StageSize } from "@edv4h/usketch-shared";
export { tiltOrigin } from "@edv4h/usketch-shared";

/**
 * Project a flat-canvas point (px, before the tilt) onto the screen, `z` px off the
 * ground (default 0). `null` at or behind the eye. Same as `projectStagePoint` in
 * `@edv4h/usketch-shared`.
 */
export const projectToGround = projectStagePoint;

/**
 * The flat-canvas point (px, before the tilt) drawn at a screen point, for points `z`
 * px off the ground (default 0). `null` above the vanishing line or behind the eye.
 * Same as `unprojectStagePoint` in `@edv4h/usketch-shared`.
 */
export const unprojectFromGround = unprojectStagePoint;
