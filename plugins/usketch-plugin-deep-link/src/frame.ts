import type { BoardStore, BoundingBox } from "@edv4h/usketch-shared";
import { getRotatedAABB, getScreenSize, safeRotation } from "@edv4h/usketch-shared";

export interface FrameOptions {
	/** Never zoom in past this level (keeps a tiny single shape from filling the screen). */
	maxZoom?: number;
	/** Screen-space padding (px) kept around the framed bounds. */
	padding?: number;
	/**
	 * Animate the move. Defaults to `false`: a deep link should land already
	 * framed (like Figma), and the instant path is reliable even when the
	 * animation's rAF loop isn't ticking yet during initial load.
	 */
	animate?: boolean;
}

/** Union AABB of the given shapes in world space (rotation-aware); `null` if none exist. */
function unionBounds(store: BoardStore, shapeIds: string[]): BoundingBox | null {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	let found = false;

	for (const id of shapeIds) {
		const s = store.getShape(id);
		if (!s) continue;
		found = true;
		const aabb = getRotatedAABB(
			{ x: s.x, y: s.y, width: s.width, height: s.height },
			// safeRotation sanitizes NaN/Infinity → 0, matching other bounds codepaths
			// so a corrupt rotation can't propagate NaN bounds and break framing.
			safeRotation(s.rotation),
		);
		minX = Math.min(minX, aabb.x);
		minY = Math.min(minY, aabb.y);
		maxX = Math.max(maxX, aabb.x + aabb.width);
		maxY = Math.max(maxY, aabb.y + aabb.height);
	}

	if (!found) return null;
	return { x: minX, y: minY, width: Math.max(maxX - minX, 1), height: Math.max(maxY - minY, 1) };
}

/**
 * Center + zoom the viewport onto `shapeIds`. Zoom is chosen to fit the union
 * bounds with padding, clamped to `[0.1, maxZoom]` so a single small shape
 * doesn't zoom to an absurd level. No-op when none of the shapes exist.
 */
export function frameShapes(store: BoardStore, shapeIds: string[], opts: FrameOptions = {}): void {
	const { maxZoom = 2, padding = 80, animate = false } = opts;

	const bounds = unionBounds(store, shapeIds);
	if (!bounds) return;

	const screen = getScreenSize();
	const fitW = (screen.width - padding * 2) / bounds.width;
	const fitH = (screen.height - padding * 2) / bounds.height;
	const zoom = Math.min(Math.max(Math.min(fitW, fitH), 0.1), maxZoom);

	const cx = bounds.x + bounds.width / 2;
	const cy = bounds.y + bounds.height / 2;
	store.animateViewportTo(
		{ x: screen.width / 2 - cx * zoom, y: screen.height / 2 - cy * zoom, zoom },
		{ animate },
	);
}
