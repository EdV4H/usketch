// Session-style helpers (drag/resize/rotate/marquee).
export {
	type DragSessionOptions,
	type DragUpdate,
	startDragSession,
} from "./drag.js";
export {
	findShapeAtPoint,
	type HoverResult,
	type TrackHoverOptions,
	trackHover,
} from "./hover.js";
// Resize handle utilities (hit testing + cursor mapping). Exposed so tools
// that build their own selection overlay can render handles consistently
// with `tool-select`.
export {
	applyFlip,
	computeMultiResizeUpdates,
	computeRawBounds,
	computeRelativeProps,
	findHandleAtScreenPoint,
	findMultiHandleAtScreenPoint,
	findRotationHandleAtScreenPoint,
	fixAnchorDrift,
	getAnchorEdges,
	getCursorForHandle,
	getHandlePositions,
	getMultiSelectionBounds,
	getRotatedCursorForHandle,
	getShapeBounds,
	HANDLE_SIZE,
	handleAxes,
	handleMovesMin,
	type MultiResizeShapeEntry,
} from "./internal/resize-handles.js";
export {
	boxContains,
	boxesIntersect,
	findShapesInRect,
	type MarqueeCommit,
	type MarqueeMode,
	type MarqueeSessionOptions,
	type MarqueeUpdate,
	startMarqueeSession,
} from "./marquee.js";
export {
	type ResizeSessionOptions,
	type ResizeUpdate,
	startResizeSession,
} from "./resize.js";
export {
	type RotateSessionOptions,
	type RotateUpdate,
	startRotateSession,
} from "./rotate.js";
export type {
	SessionCommit,
	ShapeUpdateMap,
	ToolSession,
} from "./types.js";
