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

export { HANDLE_SIZE };
