// The resize-handle utilities live in `@edv4h/usketch-tool-helpers` so they
// can be reused by other tools (Issue #576). This module preserves the old
// import path inside this package and stays as a thin re-export to avoid
// touching every internal consumer.
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
} from "@edv4h/usketch-tool-helpers";
