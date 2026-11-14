// The 3D shapes' layout moved to the CSS 3D renderer (`@edv4h/usketch-css3d-renderer`),
// which draws them now; re-exported until the next major. The limits keep the plugin's
// own `collisionIn3dOnly` next to the renderer's draw limits.
import { type Css3dShapeLimits, DEFAULT_CSS3D_SHAPE_LIMITS } from "@edv4h/usketch-css3d-renderer";

export {
	type BoxSide,
	type BoxWall,
	boxTopTransform,
	boxWalls,
	GROUND_FLAT_PARAMS,
	lerpAngle,
	poseBox,
	poseOrigin,
	poseTransform,
	render3dFrame,
	SHADOW_LIFT_PX,
	type Shape3dEntry,
	type ShapePose,
	STAND_ORIGIN,
	selectShapes3d,
	shadowStyle,
	shapeAnchor,
	shapePose,
	standFoot,
	wallColor,
	wallShade,
} from "@edv4h/usketch-css3d-renderer";

export interface Shape3dLimits extends Css3dShapeLimits {
	/** Shapes block the character only while the view is (partly) 3D. Default `false`:
	 *  like terrain steps, they block on the flat board too. */
	collisionIn3dOnly: boolean;
}

export const DEFAULT_SHAPE_3D_LIMITS: Shape3dLimits = {
	...DEFAULT_CSS3D_SHAPE_LIMITS,
	collisionIn3dOnly: false,
};
