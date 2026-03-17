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
 * Uses the pointer's world position relative to the anchor edge (the edge
 * opposite to the one being dragged). This works regardless of minSize
 * clamping — the flip triggers when the pointer physically crosses the
 * anchor, not when width/height reaches zero.
 */
export function applyFlip(
	handle: ResizeHandle,
	startData: { x: number; y: number; width: number; height: number },
	worldPoint: Point,
): {
	handle: ResizeHandle;
	startData: { x: number; y: number; width: number; height: number };
	flipped: boolean;
} {
	const axes = handleAxes(handle);
	const movesMin = handleMovesMin(handle);
	let h = handle;
	let sx = startData.x;
	let sy = startData.y;
	let sw = startData.width;
	let sh = startData.height;
	let flipped = false;

	if (axes.x) {
		if (movesMin.x) {
			// Dragging left edge → anchor is right edge
			const anchorX = sx + sw;
			if (worldPoint.x > anchorX) {
				flipped = true;
				h = FLIP_X[h];
				sx = anchorX;
				sw = 0;
			}
		} else {
			// Dragging right edge → anchor is left edge
			const anchorX = sx;
			if (worldPoint.x < anchorX) {
				flipped = true;
				h = FLIP_X[h];
				sx = anchorX;
				sw = 0;
			}
		}
	}

	if (axes.y) {
		if (movesMin.y) {
			// Dragging top edge → anchor is bottom edge
			const anchorY = sy + sh;
			if (worldPoint.y > anchorY) {
				flipped = true;
				h = FLIP_Y[h];
				sy = anchorY;
				sh = 0;
			}
		} else {
			// Dragging bottom edge → anchor is top edge
			const anchorY = sy;
			if (worldPoint.y < anchorY) {
				flipped = true;
				h = FLIP_Y[h];
				sy = anchorY;
				sh = 0;
			}
		}
	}

	return {
		handle: h,
		startData: { x: sx, y: sy, width: sw, height: sh },
		flipped,
	};
}

/**
 * Fix position after minSize clamping in def.resize().
 *
 * Normal case (no clamping): anchor the opposite edge so it stays fixed.
 * Clamped case: the dragged edge follows the pointer, and the shape slides
 * at minSize until the pointer crosses the anchor and a flip occurs.
 */
export function fixAnchorDrift(
	handle: ResizeHandle,
	startData: { x: number; y: number; width: number; height: number },
	resized: { x: number; y: number; width: number; height: number },
	worldPoint: Point,
): { x: number; y: number } {
	const axes = handleAxes(handle);
	const movesMin = handleMovesMin(handle);
	let { x, y } = resized;

	if (axes.x) {
		const anchorRight = startData.x + startData.width;
		const anchorLeft = startData.x;
		// Compute raw (unclamped) width to detect clamping
		const rawWidth = movesMin.x ? anchorRight - worldPoint.x : worldPoint.x - anchorLeft;
		const clamped = resized.width > rawWidth;

		if (clamped) {
			// MinSize reached: dragged edge follows pointer, shape slides
			if (movesMin.x) {
				x = worldPoint.x;
			} else {
				x = worldPoint.x - resized.width;
			}
		} else if (movesMin.x) {
			// Normal: anchor the right edge
			x = anchorRight - resized.width;
		}
		// movesMax + no clamp: x stays as resized (unchanged from startData.x)
	}

	if (axes.y) {
		const anchorBottom = startData.y + startData.height;
		const anchorTop = startData.y;
		const rawHeight = movesMin.y ? anchorBottom - worldPoint.y : worldPoint.y - anchorTop;
		const clamped = resized.height > rawHeight;

		if (clamped) {
			if (movesMin.y) {
				y = worldPoint.y;
			} else {
				y = worldPoint.y - resized.height;
			}
		} else if (movesMin.y) {
			y = anchorBottom - resized.height;
		}
	}

	return { x, y };
}

export { HANDLE_SIZE };
