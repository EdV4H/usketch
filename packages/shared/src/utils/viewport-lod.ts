import type { BoundingBox } from "../types/geometry.js";
import type { ShapeData } from "../types/shape.js";
import { getRotatedAABB, safeRotation } from "./rotation.js";

/**
 * Axis-aligned world bounds of a shape, accounting for rotation. Mirrors the
 * store's spatial-index bounds (`board-store.shapeToBounds`) so viewport
 * decisions match what the index would report.
 */
export function getShapeAABB(shape: ShapeData): BoundingBox {
	const bounds = { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
	const rotation = safeRotation(shape.rotation);
	if (rotation === 0) return bounds;
	return getRotatedAABB(bounds, rotation);
}

/** Whether two axis-aligned rects overlap (touching edges do not count). */
export function rectsIntersect(a: BoundingBox, b: BoundingBox): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Scale a rect by `ratio` about its center (width/height × ratio, center fixed).
 * `ratio > 1` grows the rect, `ratio < 1` shrinks it, `ratio === 1` is identity.
 */
export function scaleRectAboutCenter(rect: BoundingBox, ratio: number): BoundingBox {
	const cx = rect.x + rect.width / 2;
	const cy = rect.y + rect.height / 2;
	const width = rect.width * ratio;
	const height = rect.height * ratio;
	return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/**
 * Whether a shape falls outside the "full-detail" region — used to decide
 * per-shape LOD (off-screen shapes render simplified).
 *
 * The full-detail region is `viewportBounds` scaled about its center by `ratio`:
 * `1.0` = exactly the viewport, `1.2` = 20% beyond it (buffer so panning doesn't
 * pop shapes in/out at the edge), `0.5` = only the central half (even in-view
 * edge shapes become LOD). A shape is "outside" when its rotation-aware AABB does
 * not intersect that region.
 *
 * Returns `false` (i.e. treat as in-view / full detail) when `viewportBounds` has
 * non-positive size — the canvas hasn't been measured yet, so we must not hide
 * everything.
 */
export function isShapeOutsideViewport(
	shape: ShapeData,
	viewportBounds: BoundingBox,
	ratio: number,
): boolean {
	if (viewportBounds.width <= 0 || viewportBounds.height <= 0) return false;
	const region = ratio === 1 ? viewportBounds : scaleRectAboutCenter(viewportBounds, ratio);
	return !rectsIntersect(region, getShapeAABB(shape));
}
