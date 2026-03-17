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
 * Compute the raw (unclamped) width/height after applying delta,
 * and if either goes negative, flip the handle and adjust startData/delta.
 *
 * Returns the effective handle, delta, and startData to use for def.resize().
 * If no flip occurred, returns the inputs unchanged.
 */
export function applyFlip(
	handle: ResizeHandle,
	startData: { x: number; y: number; width: number; height: number },
	delta: Point,
): {
	handle: ResizeHandle;
	delta: Point;
	startData: { x: number; y: number; width: number; height: number };
	flipped: boolean;
} {
	const axes = handleAxes(handle);
	const movesMin = handleMovesMin(handle);
	let h = handle;
	let dx = delta.x;
	let dy = delta.y;
	let sx = startData.x;
	let sy = startData.y;
	let sw = startData.width;
	let sh = startData.height;
	let flipped = false;

	if (axes.x) {
		const rawWidth = movesMin.x ? sw - dx : sw + dx;
		if (rawWidth < 0) {
			flipped = true;
			h = FLIP_X[h];
			// Anchor flips to the opposite edge; excess delta drives new size
			if (movesMin.x) {
				// Was dragging left edge past right edge
				dx = dx - sw;
				sx = sx + sw;
			} else {
				// Was dragging right edge past left edge
				dx = dx + sw;
			}
			sw = 0;
		}
	}

	if (axes.y) {
		const rawHeight = movesMin.y ? sh - dy : sh + dy;
		if (rawHeight < 0) {
			flipped = true;
			h = FLIP_Y[h];
			if (movesMin.y) {
				dy = dy - sh;
				sy = sy + sh;
			} else {
				dy = dy + sh;
			}
			sh = 0;
		}
	}

	return {
		handle: h,
		delta: { x: dx, y: dy },
		startData: { x: sx, y: sy, width: sw, height: sh },
		flipped,
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

export { HANDLE_SIZE };
