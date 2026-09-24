import type { BoundingBox, Point, Viewport } from "../types/geometry.js";

/** The viewport's rotation in degrees (`0` when unset or non-finite). */
export function viewportRotation(vp: Viewport): number {
	const r = vp.rotation;
	return typeof r === "number" && Number.isFinite(r) ? r : 0;
}

/** ワールド座標をスクリーン座標に変換（`screen = R(rot)·(zoom·world) + (x, y)`） */
export function worldToScreen(wx: number, wy: number, vp: Viewport): Point {
	const deg = viewportRotation(vp);
	if (deg === 0) return { x: wx * vp.zoom + vp.x, y: wy * vp.zoom + vp.y };
	const rad = (deg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const sx = wx * vp.zoom;
	const sy = wy * vp.zoom;
	return { x: sx * cos - sy * sin + vp.x, y: sx * sin + sy * cos + vp.y };
}

/** スクリーン座標をワールド座標に変換（worldToScreen の逆） */
export function screenToWorld(sx: number, sy: number, vp: Viewport): Point {
	const deg = viewportRotation(vp);
	if (deg === 0) return { x: (sx - vp.x) / vp.zoom, y: (sy - vp.y) / vp.zoom };
	const rad = (deg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const dx = sx - vp.x;
	const dy = sy - vp.y;
	// R(-rot) · (p - t), then undo the zoom.
	return { x: (dx * cos + dy * sin) / vp.zoom, y: (-dx * sin + dy * cos) / vp.zoom };
}

/**
 * The viewport (with the given zoom/rotation) that places world point `world` at
 * screen point `screen` — the inverse problem every "center on / keep under cursor /
 * follow" operation solves: `t = screen − R(rot)·(zoom·world)`.
 */
export function viewportAnchoredAt(
	world: Point,
	screen: Point,
	zoom: number,
	rotation = 0,
): Viewport {
	const origin = worldToScreen(world.x, world.y, { x: 0, y: 0, zoom, rotation });
	const vp: Viewport = { x: screen.x - origin.x, y: screen.y - origin.y, zoom };
	if (rotation !== 0) vp.rotation = rotation;
	return vp;
}

/**
 * World-space AABB of a screen rectangle `[0,0,width,height]` — the visible region.
 * Under rotation this is the bounding box of the four inverse-mapped corners, so it
 * always covers everything on screen (equal to the exact rect when unrotated).
 */
export function screenRectToWorldBounds(width: number, height: number, vp: Viewport): BoundingBox {
	if (viewportRotation(vp) === 0) {
		return {
			x: -vp.x / vp.zoom,
			y: -vp.y / vp.zoom,
			width: width / vp.zoom,
			height: height / vp.zoom,
		};
	}
	const corners = [
		screenToWorld(0, 0, vp),
		screenToWorld(width, 0, vp),
		screenToWorld(0, height, vp),
		screenToWorld(width, height, vp),
	];
	const xs = corners.map((c) => c.x);
	const ys = corners.map((c) => c.y);
	const minX = Math.min(...xs);
	const minY = Math.min(...ys);
	return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

// ── Overlay frame ────────────────────────────────────────────────────────────
// Screen-space overlays (selection handles, snap guides, …) position things with
// the UNROTATED formula `zoom·w + (x, y)`. Under camera rotation the canvas renders
// such a layer inside a wrapper turned by `rotation` about `(x, y)` (the world
// origin on screen), because `R·(zoom·w) + t = t + R·((zoom·w + t) − t)` — i.e. the
// unrotated position turned about `t` is exactly the true screen position. So
// overlay code keeps its math, given `unrotatedViewport(vp)`, and pointer hit tests
// compare in the same "overlay frame" via `screenToOverlay`.

/** The viewport without its rotation — what overlay-frame code computes with. */
export function unrotatedViewport(vp: Viewport): Viewport {
	if (vp.rotation === undefined) return vp;
	return { x: vp.x, y: vp.y, zoom: vp.zoom };
}

/** Map a real screen point into the overlay frame (inverse of the overlay wrapper). */
export function screenToOverlay(sx: number, sy: number, vp: Viewport): Point {
	const deg = viewportRotation(vp);
	if (deg === 0) return { x: sx, y: sy };
	const rad = (deg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const dx = sx - vp.x;
	const dy = sy - vp.y;
	return { x: vp.x + dx * cos + dy * sin, y: vp.y - dx * sin + dy * cos };
}

/** CSS for the overlay-frame wrapper, or `null` when the camera isn't rotated. */
export function overlayFrameStyle(
	vp: Viewport,
): { transform: string; transformOrigin: string } | null {
	const deg = viewportRotation(vp);
	if (deg === 0) return null;
	return { transform: `rotate(${deg}deg)`, transformOrigin: `${vp.x}px ${vp.y}px` };
}

/** CSS transform for a world-space layer (`transform-origin: 0 0`). */
export function viewportTransformStyle(vp: Viewport): string {
	const deg = viewportRotation(vp);
	const base = `translate(${vp.x}px, ${vp.y}px)`;
	return deg === 0 ? `${base} scale(${vp.zoom})` : `${base} rotate(${deg}deg) scale(${vp.zoom})`;
}

/**
 * 複数シェイプのバウンディングボックスを計算。
 * getBounds関数を受け取ることでShapeRegistryへの依存を避ける。
 */
export function getSelectionBounds(
	shapeIds: ReadonlySet<string>,
	getBounds: (id: string) => BoundingBox | null,
): BoundingBox | null {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const id of shapeIds) {
		const bounds = getBounds(id);
		if (!bounds) continue;
		minX = Math.min(minX, bounds.x);
		minY = Math.min(minY, bounds.y);
		maxX = Math.max(maxX, bounds.x + bounds.width);
		maxY = Math.max(maxY, bounds.y + bounds.height);
	}

	if (!Number.isFinite(minX)) return null;
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * バウンディングボックスのスクリーン座標を返す。
 * anchor位置の計算に便利。
 */
export function boundsToScreenRect(
	bounds: BoundingBox,
	vp: Viewport,
): {
	x: number;
	y: number;
	width: number;
	height: number;
	centerX: number;
	centerY: number;
	bottom: number;
} {
	const tl = worldToScreen(bounds.x, bounds.y, vp);
	const br = worldToScreen(bounds.x + bounds.width, bounds.y + bounds.height, vp);
	return {
		x: tl.x,
		y: tl.y,
		width: br.x - tl.x,
		height: br.y - tl.y,
		centerX: (tl.x + br.x) / 2,
		centerY: (tl.y + br.y) / 2,
		bottom: br.y,
	};
}
