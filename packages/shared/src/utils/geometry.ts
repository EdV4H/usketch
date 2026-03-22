import type { BoundingBox, Point, Viewport } from "../types/geometry.js";

/** ワールド座標をスクリーン座標に変換 */
export function worldToScreen(wx: number, wy: number, vp: Viewport): Point {
	return { x: wx * vp.zoom + vp.x, y: wy * vp.zoom + vp.y };
}

/** スクリーン座標をワールド座標に変換 */
export function screenToWorld(sx: number, sy: number, vp: Viewport): Point {
	return { x: (sx - vp.x) / vp.zoom, y: (sy - vp.y) / vp.zoom };
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
