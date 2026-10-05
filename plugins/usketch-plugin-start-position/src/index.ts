export { createStartPositionPlugin } from "./plugin.js";
export {
	applyStartPosition,
	captureViewport,
} from "./resolve.js";
export {
	createStartPositionShapeDefinition,
	findStartPosition,
	isStartPosition,
	makeStartPosition,
	START_POSITION_TYPE,
	type StartPosition,
	type StartPositionShapeData,
} from "./start-position-shape.js";
export {
	claimViewport,
	DEEP_LINK_PRIORITY,
	START_POSITION_PRIORITY,
	VIEWPORT_CLAIMED,
	type ViewportClaim,
	watchViewportClaims,
} from "./viewport-claim.js";
