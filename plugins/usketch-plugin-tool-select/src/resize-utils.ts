import type {
	BoardStore,
	BoundingBox,
	Point,
	ResizeHandle,
	ShapeRegistry,
	Viewport,
} from "@edv4h/usketch-shared";

const HANDLE_SIZE = 8;
const HIT_AREA = 20;

const ALL_HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function worldToScreen(wx: number, wy: number, vp: Viewport): Point {
	return { x: wx * vp.zoom + vp.x, y: wy * vp.zoom + vp.y };
}

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
			return { shapeId, handle };
		}
	}

	return null;
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
function handleAxes(handle: ResizeHandle): { x: boolean; y: boolean } {
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
function handleMovesMin(handle: ResizeHandle): { x: boolean; y: boolean } {
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

export { HANDLE_SIZE };
