export { createShape3dPlugin, type Shape3dPluginOptions } from "./plugin.js";
export { registerShape3dHud } from "./register-shape-3d-hud.js";
export { SHAPE_3D_LAYER_ID, type Shape3dCameraSource } from "./shape-3d-layer.js";
export {
	type BoxSide,
	type BoxWall,
	boxTopTransform,
	boxWalls,
	DEFAULT_SHAPE_3D_LIMITS,
	lerpAngle,
	poseBox,
	poseOrigin,
	poseTransform,
	render3dFrame,
	SHADOW_LIFT_PX,
	type Shape3dEntry,
	type Shape3dLimits,
	type ShapePose,
	STAND_ORIGIN,
	selectShapes3d,
	shadowStyle,
	shapeAnchor,
	shapePose,
	standFoot,
	wallColor,
	wallShade,
} from "./shape-3d-layout.js";
export { clearShape3d, getShape3d, setShape3d } from "./shape-3d-ops.js";
export {
	availableModes,
	DEFAULT_SHAPE_3D_HEIGHT,
	DEFAULT_SHAPE_3D_PARAMS,
	DEFAULT_SHAPE_3D_TYPES,
	DEFAULT_TYPE_MODES,
	MAX_SHAPE_3D_HEIGHT,
	mergeShape3dTypes,
	normalizeShape3d,
	ownShape3d,
	resolveShape3d,
	SHAPE_3D_KEY,
	SHAPE_3D_MODES,
	type Shape3dFacing,
	type Shape3dInput,
	type Shape3dMode,
	type Shape3dParams,
	type Shape3dTypeConfig,
	type Shape3dTypes,
	storedShape3d,
} from "./shape-3d-params.js";
export {
	crossRender3d,
	type Shape3dRender,
	type Shape3dRenderContext,
} from "./shape-3d-render3d.js";
export { getShape3dApi, type Shape3dApi, shape3dService } from "./shape-3d-service.js";
export { STAGE_3D_EVENT } from "./view-3d-tracker.js";
