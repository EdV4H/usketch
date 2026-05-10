import type {
	BoardStore,
	BoundingBox,
	Point,
	ResizeHandle,
	ShapeRegistry,
	Viewport,
} from "@edv4h/usketch-shared";
import {
	getSelectionBounds,
	normalizeAngle,
	safeRotation,
	unrotatePoint,
	worldToScreen,
} from "@edv4h/usketch-shared";

const HANDLE_SIZE = 8;
const HIT_AREA = 20;

const ALL_HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

export function getHandlePositions(
	bounds: BoundingBox,
	viewport: Viewport,
): Map<ResizeHandle, Point> {
	const tl = worldToScreen(bounds.x, bounds.y, viewport);
	const br = worldToScreen(bounds.x + bounds.width, bounds.y + bounds.height, viewport);
	const mx = (tl.x + br.x) / 2;
	const my = (tl.y + br.y) / 2;

	const positions = new Map<ResizeHandle, Point>();
	positions.set("nw", { x: tl.x, y: tl.y });
	positions.set("n", { x: mx, y: tl.y });
	positions.set("ne", { x: br.x, y: tl.y });
	positions.set("e", { x: br.x, y: my });
	positions.set("se", { x: br.x, y: br.y });
	positions.set("s", { x: mx, y: br.y });
	positions.set("sw", { x: tl.x, y: br.y });
	positions.set("w", { x: tl.x, y: my });
	return positions;
}

export function findHandleAtScreenPoint(
	screenPoint: Point,
	shapes: ShapeRegistry,
	store: BoardStore,
	viewport: Viewport,
): { shapeId: string; handle: ResizeHandle } | null {
	const selection = store.getSelection();
	if (selection.size !== 1) return null;

	const shapeId = [...selection][0];
	const shape = store.getShape(shapeId);
	if (!shape) return null;

	const def = shapes.get(shape.type);
	const bounds = def
		? def.getBounds(shape)
		: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
	const positions = getHandlePositions(bounds, viewport);

	// Un-rotate the screen point if shape is rotated, so handle positions
	// (which are computed in un-rotated screen space) can be compared correctly.
	const rotation = safeRotation(shape.rotation);
	let testPoint = screenPoint;
	if (rotation !== 0) {
		const screenCenter = worldToScreen(
			bounds.x + bounds.width / 2,
			bounds.y + bounds.height / 2,
			viewport,
		);
		testPoint = unrotatePoint(screenPoint, screenCenter, (rotation * Math.PI) / 180);
	}

	const halfHit = HIT_AREA / 2;
	for (const handle of ALL_HANDLES) {
		const pos = positions.get(handle);
		if (!pos) continue;
		if (
			testPoint.x >= pos.x - halfHit &&
			testPoint.x <= pos.x + halfHit &&
			testPoint.y >= pos.y - halfHit &&
			testPoint.y <= pos.y + halfHit
		) {
			return { shapeId, handle };
		}
	}

	return null;
}

/** Figma 方式: 角のリサイズハンドルの外側エリアで回転を検出する */
const ROTATION_OUTER_MARGIN = 12;

export function findRotationHandleAtScreenPoint(
	screenPoint: Point,
	shapes: ShapeRegistry,
	store: BoardStore,
	viewport: Viewport,
): string | null {
	const selection = store.getSelection();
	if (selection.size !== 1) return null;

	const shapeId = [...selection][0];
	const shape = store.getShape(shapeId);
	if (!shape) return null;

	const def = shapes.get(shape.type);
	if (def?.resizable === false) return null;

	const bounds = def
		? def.getBounds(shape)
		: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };

	const rotation = safeRotation(shape.rotation);

	// Un-rotate the screen point to test in axis-aligned space
	const screenCenter = worldToScreen(
		bounds.x + bounds.width / 2,
		bounds.y + bounds.height / 2,
		viewport,
	);
	let testPoint = screenPoint;
	if (rotation !== 0) {
		testPoint = unrotatePoint(screenPoint, screenCenter, (rotation * Math.PI) / 180);
	}

	// Check if the point is near a corner but OUTSIDE the resize handle hit area
	const positions = getHandlePositions(bounds, viewport);
	const cornerHandles: ResizeHandle[] = ["nw", "ne", "se", "sw"];
	const halfHit = HIT_AREA / 2;
	const outerDist = halfHit + ROTATION_OUTER_MARGIN;

	for (const handle of cornerHandles) {
		const pos = positions.get(handle);
		if (!pos) continue;
		const dx = testPoint.x - pos.x;
		const dy = testPoint.y - pos.y;
		const dist = Math.hypot(dx, dy);
		// Outside resize hit area but within rotation area
		if (dist > halfHit && dist <= outerDist) {
			return shapeId;
		}
	}

	return null;
}

/** 回転済みシェイプのリサイズカーソルを返す */
export function getRotatedCursorForHandle(handle: ResizeHandle, rotationDeg: number): string {
	const baseAngles: Record<ResizeHandle, number> = {
		n: 0,
		ne: 45,
		e: 90,
		se: 135,
		s: 180,
		sw: 225,
		w: 270,
		nw: 315,
	};
	const angle = normalizeAngle(baseAngles[handle] + rotationDeg);
	const snapped = Math.round(angle / 45) % 4;
	const cursors = ["ns-resize", "nesw-resize", "ew-resize", "nwse-resize"];
	return cursors[snapped];
}

const CURSOR_MAP: Record<ResizeHandle, string> = {
	nw: "nwse-resize",
	se: "nwse-resize",
	ne: "nesw-resize",
	sw: "nesw-resize",
	n: "ns-resize",
	s: "ns-resize",
	e: "ew-resize",
	w: "ew-resize",
};

export function getCursorForHandle(handle: ResizeHandle): string {
	return CURSOR_MAP[handle];
}

// ── Flip support ──

/** Which axes a handle affects */
export function handleAxes(handle: ResizeHandle): { x: boolean; y: boolean } {
	switch (handle) {
		case "e":
		case "w":
			return { x: true, y: false };
		case "n":
		case "s":
			return { x: false, y: true };
		default:
			return { x: true, y: true };
	}
}

/** Whether the handle moves the min edge (left/top) on each axis */
export function handleMovesMin(handle: ResizeHandle): { x: boolean; y: boolean } {
	const movesMinX = handle === "nw" || handle === "w" || handle === "sw";
	const movesMinY = handle === "nw" || handle === "n" || handle === "ne";
	return { x: movesMinX, y: movesMinY };
}

const FLIP_X: Record<ResizeHandle, ResizeHandle> = {
	nw: "ne",
	ne: "nw",
	sw: "se",
	se: "sw",
	w: "e",
	e: "w",
	n: "n",
	s: "s",
};

const FLIP_Y: Record<ResizeHandle, ResizeHandle> = {
	nw: "sw",
	sw: "nw",
	ne: "se",
	se: "ne",
	n: "s",
	s: "n",
	e: "e",
	w: "w",
};

/**
 * Detect if the pointer has crossed the anchor edge and flip the handle.
 *
 * `bounds` should be unclamped (raw) bounds so that minSize clamping
 * doesn't prevent flip detection. The flip triggers when the pointer
 * physically crosses the anchor edge.
 */
export function applyFlip(
	handle: ResizeHandle,
	bounds: { x: number; y: number; width: number; height: number },
	worldPoint: Point,
): {
	handle: ResizeHandle;
	flipped: boolean;
	flippedX: boolean;
	flippedY: boolean;
} {
	const axes = handleAxes(handle);
	const movesMin = handleMovesMin(handle);
	let h = handle;
	let flippedX = false;
	let flippedY = false;

	if (axes.x) {
		if (movesMin.x) {
			const anchorX = bounds.x + bounds.width;
			if (worldPoint.x > anchorX) {
				flippedX = true;
				h = FLIP_X[h];
			}
		} else {
			const anchorX = bounds.x;
			if (worldPoint.x < anchorX) {
				flippedX = true;
				h = FLIP_X[h];
			}
		}
	}

	if (axes.y) {
		if (movesMin.y) {
			const anchorY = bounds.y + bounds.height;
			if (worldPoint.y > anchorY) {
				flippedY = true;
				h = FLIP_Y[h];
			}
		} else {
			const anchorY = bounds.y;
			if (worldPoint.y < anchorY) {
				flippedY = true;
				h = FLIP_Y[h];
			}
		}
	}

	return {
		handle: h,
		flipped: flippedX || flippedY,
		flippedX,
		flippedY,
	};
}

/**
 * Fix anchor drift caused by minSize clamping in def.resize().
 *
 * When a shape clamps width/height to a minimum, the dragged edge stops
 * but x/y may still shift — causing the anchored (opposite) edge to move.
 * This corrects x/y so the anchored edge stays fixed.
 */
export function fixAnchorDrift(
	handle: ResizeHandle,
	startData: { x: number; y: number; width: number; height: number },
	resized: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
	const movesMin = handleMovesMin(handle);
	let { x, y } = resized;

	if (movesMin.x) {
		// Left edge is moving → right edge (x + width) must stay fixed
		const anchorRight = startData.x + startData.width;
		x = anchorRight - resized.width;
	}

	if (movesMin.y) {
		// Top edge is moving → bottom edge (y + height) must stay fixed
		const anchorBottom = startData.y + startData.height;
		y = anchorBottom - resized.height;
	}

	return { x, y };
}

/**
 * Get the anchor edge positions for a handle.
 *
 * Returns the x/y position of the anchor edge (the edge that stays fixed).
 * - movesMin.x → anchor is right edge (x + width)
 * - !movesMin.x → anchor is left edge (x) — but only if the handle moves x at all
 * - undefined means that axis has no anchor (e.g. "n"/"s" have no x anchor)
 */
export function getAnchorEdges(
	handle: ResizeHandle,
	startData: { x: number; y: number; width: number; height: number },
): { x: number | undefined; y: number | undefined } {
	const axes = handleAxes(handle);
	const movesMin = handleMovesMin(handle);

	const x = axes.x ? (movesMin.x ? startData.x + startData.width : startData.x) : undefined;
	const y = axes.y ? (movesMin.y ? startData.y + startData.height : startData.y) : undefined;

	return { x, y };
}

/**
 * Compute raw (unclamped) bounds after applying a resize delta.
 *
 * Unlike `def.resize()`, this does NOT apply minSize clamping,
 * so width/height can go negative. This is essential for flip
 * detection — the pointer must be compared against the true
 * geometric anchor, not the clamped one.
 */
export function computeRawBounds(
	startData: { x: number; y: number; width: number; height: number },
	handle: ResizeHandle,
	delta: { x: number; y: number },
): { x: number; y: number; width: number; height: number } {
	let { x, y, width, height } = startData;
	switch (handle) {
		case "se":
			width += delta.x;
			height += delta.y;
			break;
		case "nw":
			x += delta.x;
			y += delta.y;
			width -= delta.x;
			height -= delta.y;
			break;
		case "ne":
			y += delta.y;
			width += delta.x;
			height -= delta.y;
			break;
		case "sw":
			x += delta.x;
			width -= delta.x;
			height += delta.y;
			break;
		case "e":
			width += delta.x;
			break;
		case "w":
			x += delta.x;
			width -= delta.x;
			break;
		case "n":
			y += delta.y;
			height -= delta.y;
			break;
		case "s":
			height += delta.y;
			break;
	}
	return { x, y, width, height };
}

// ── Multi-selection helpers ──

export function getShapeBounds(
	store: BoardStore,
	shapes: ShapeRegistry,
	id: string,
): BoundingBox | null {
	const shape = store.getShape(id);
	if (!shape) return null;
	const def = shapes.get(shape.type);
	return def
		? def.getBounds(shape)
		: { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
}

export function getMultiSelectionBounds(
	store: BoardStore,
	shapes: ShapeRegistry,
	selection: ReadonlySet<string>,
): BoundingBox | null {
	return getSelectionBounds(selection, (id) => getShapeBounds(store, shapes, id));
}

export function findMultiHandleAtScreenPoint(
	screenPoint: Point,
	groupBounds: BoundingBox,
	viewport: Viewport,
): ResizeHandle | null {
	const positions = getHandlePositions(groupBounds, viewport);
	const halfHit = HIT_AREA / 2;
	for (const handle of ALL_HANDLES) {
		const pos = positions.get(handle);
		if (!pos) continue;
		if (
			screenPoint.x >= pos.x - halfHit &&
			screenPoint.x <= pos.x + halfHit &&
			screenPoint.y >= pos.y - halfHit &&
			screenPoint.y <= pos.y + halfHit
		) {
			return handle;
		}
	}
	return null;
}

const MIN_GROUP_SIZE = 10;

export interface MultiResizeShapeEntry {
	x: number;
	y: number;
	width: number;
	height: number;
	minWidth: number;
	minHeight: number;
	// Normalized relative ratios (position & size within group, 0–1)
	relX: number;
	relY: number;
	relWidth: number;
	relHeight: number;
}

export function computeRelativeProps(
	shapeData: { x: number; y: number; width: number; height: number },
	groupBounds: BoundingBox,
): { relX: number; relY: number; relWidth: number; relHeight: number } {
	const relX = groupBounds.width > 0 ? (shapeData.x - groupBounds.x) / groupBounds.width : 0;
	const relY = groupBounds.height > 0 ? (shapeData.y - groupBounds.y) / groupBounds.height : 0;
	const relWidth = groupBounds.width > 0 ? shapeData.width / groupBounds.width : 1;
	const relHeight = groupBounds.height > 0 ? shapeData.height / groupBounds.height : 1;
	return { relX, relY, relWidth, relHeight };
}

export function computeMultiResizeUpdates(
	handle: ResizeHandle,
	startGroupBounds: BoundingBox,
	delta: Point,
	startShapeData: Map<string, MultiResizeShapeEntry>,
): Map<string, { x: number; y: number; width: number; height: number }> {
	const raw = computeRawBounds(startGroupBounds, handle, delta);

	const axes = handleAxes(handle);
	const movesMin = handleMovesMin(handle);

	// Compute minimum group size from the largest per-shape minSize,
	// using relative ratios so it works even when startGroupBounds is zero-size.
	let minGroupW = MIN_GROUP_SIZE;
	let minGroupH = MIN_GROUP_SIZE;
	for (const data of startShapeData.values()) {
		if (data.relWidth > 0) {
			const requiredGroupW = data.minWidth / data.relWidth;
			if (requiredGroupW > minGroupW) minGroupW = requiredGroupW;
		}
	}
	for (const data of startShapeData.values()) {
		if (data.relHeight > 0) {
			const requiredGroupH = data.minHeight / data.relHeight;
			if (requiredGroupH > minGroupH) minGroupH = requiredGroupH;
		}
	}

	// Clamp to minimum group size
	if (axes.x && raw.width < minGroupW) {
		if (movesMin.x) {
			raw.x = raw.x + raw.width - minGroupW;
		}
		raw.width = minGroupW;
	}
	if (axes.y && raw.height < minGroupH) {
		if (movesMin.y) {
			raw.y = raw.y + raw.height - minGroupH;
		}
		raw.height = minGroupH;
	}

	const result = new Map<string, { x: number; y: number; width: number; height: number }>();

	for (const [id, data] of startShapeData) {
		const newX = raw.x + data.relX * raw.width;
		const newY = raw.y + data.relY * raw.height;
		const newWidth = Math.max(data.minWidth, data.relWidth * raw.width);
		const newHeight = Math.max(data.minHeight, data.relHeight * raw.height);
		result.set(id, { x: newX, y: newY, width: newWidth, height: newHeight });
	}

	return result;
}

export { HANDLE_SIZE };
