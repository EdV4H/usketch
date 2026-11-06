export { createShape3dPlugin, type Shape3dPluginOptions } from "./plugin.js";
export { registerShape3dHud } from "./register-shape-3d-hud.js";
export { SHAPE_3D_LAYER_ID } from "./shape-3d-layer.js";
export {
	DEFAULT_SHAPE_3D_LIMITS,
	lerpAngle,
	SHADOW_LIFT_PX,
	type Shape3dEntry,
	type Shape3dLimits,
	STAND_ORIGIN,
	type StandPose,
	selectShapes3d,
	shadowStyle,
	standBox,
	standFoot,
	standPose,
	standTransform,
} from "./shape-3d-layout.js";
export { clearShape3d, getShape3d, setShape3d } from "./shape-3d-ops.js";
export {
	availableModes,
	DEFAULT_SHAPE_3D_PARAMS,
	DEFAULT_SHAPE_3D_TYPES,
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
} from "./shape-3d-params.js";
export { getShape3dApi, type Shape3dApi, shape3dService } from "./shape-3d-service.js";
export { STAGE_3D_EVENT } from "./view-3d-tracker.js";
