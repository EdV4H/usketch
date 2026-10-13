// Resolve a StartPosition into an actual camera move. Kept separate from the
// plugin wiring so it is easy to unit-test against a fake store.
import type { BoardStore } from "@edv4h/usketch-shared";
import {
	centerOnWorld,
	getRotatedAABB,
	getScreenSize,
	safeRotation,
	screenToWorld,
} from "@edv4h/usketch-shared";
import { isStartPosition, type StartPosition } from "./start-position-shape.js";

export type ViewportSizeGetter = () => { width: number; height: number };

export interface ApplyOptions {
	animate?: boolean;
	durationMs?: number;
	/** Size of the canvas in screen px. Defaults to the window (see `getScreenSize`). */
	getViewportSize?: ViewportSizeGetter;
}

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const clampZoom = (z: number): number => Math.min(Math.max(z, ZOOM_MIN), ZOOM_MAX);

/**
 * Move the camera to a start position. Returns `false` when it can't be resolved
 * — an unframeable `shape` target (deleted / zero-size) OR malformed coordinates
 * from corrupt synced data — so callers can fall back (e.g. frame all content).
 *
 * `start` comes from synced/persisted shape data, so it is **validated**: a
 * non-finite x/y/zoom (or non-positive zoom) is rejected rather than fed into
 * `animateViewportTo` (which does not clamp) and left to corrupt the viewport.
 */
export function applyStartPosition(
	store: BoardStore,
	start: StartPosition,
	opts: ApplyOptions = {},
): boolean {
	const { animate = false, durationMs, getViewportSize = getScreenSize } = opts;
	switch (start.kind) {
		case "coordinate":
			if (!isNum(start.x) || !isNum(start.y)) return false;
			// Keep the viewer's current zoom; only recenter.
			centerOnWorld(store, { x: start.x, y: start.y }, { animate, durationMs });
			return true;
		case "viewport":
			if (!isNum(start.x) || !isNum(start.y) || !isNum(start.zoom) || start.zoom <= 0) return false;
			centerOnWorld(
				store,
				{ x: start.x, y: start.y },
				{ zoom: clampZoom(start.zoom), animate, durationMs },
			);
			return true;
		case "shape": {
			const s = store.getShape(start.shapeId);
			if (!s) return false;
			const aabb = getRotatedAABB(
				{ x: s.x, y: s.y, width: s.width, height: s.height },
				safeRotation(s.rotation),
			);
			// `fitToBounds` is a no-op for a non-positive/NaN box, which would leave the
			// camera unmoved while we wrongly report success — reject so callers fall back.
			if (!isNum(aabb.x) || !isNum(aabb.y) || !(aabb.width > 0) || !(aabb.height > 0)) return false;
			const padding = isNum(start.padding) && start.padding >= 0 ? start.padding : 80;
			store.fitToBounds(aabb, getViewportSize(), padding, { animate, durationMs });
			return true;
		}
	}
}

/** The current camera as an exact framing (world center point + zoom) — screen-size
 *  independent, so it reproduces on any viewer. Backs "set current view as start". */
export function captureViewport(store: BoardStore): { x: number; y: number; zoom: number } {
	const vp = store.getViewport();
	const { width, height } = getScreenSize();
	const c = screenToWorld(width / 2, height / 2, vp);
	return { x: c.x, y: c.y, zoom: vp.zoom };
}

/**
 * Frame every content shape. Unlike the shared `fitContent`, this ignores the
 * start-position shape itself (a zero-size data-only shape at the origin that
 * would stretch the bounds), uses rotation-aware bounds, and can measure a canvas
 * that isn't the whole window. `fitToBounds` clamps the zoom, so content too large
 * for the zoom floor ends up centered at the minimum zoom.
 *
 * Returns `false` (camera untouched) when there is nothing to frame.
 */
export function fitAllContent(
	store: BoardStore,
	opts: ApplyOptions & { padding?: number } = {},
): boolean {
	const { animate = false, durationMs, getViewportSize = getScreenSize, padding = 40 } = opts;
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const s of store.getShapes().values()) {
		if (isStartPosition(s)) continue;
		const b = getRotatedAABB(
			{ x: s.x, y: s.y, width: s.width, height: s.height },
			safeRotation(s.rotation),
		);
		if (!isNum(b.x) || !isNum(b.y) || !isNum(b.width) || !isNum(b.height)) continue;
		minX = Math.min(minX, b.x);
		minY = Math.min(minY, b.y);
		maxX = Math.max(maxX, b.x + b.width);
		maxY = Math.max(maxY, b.y + b.height);
	}
	const width = maxX - minX;
	const height = maxY - minY;
	if (!(width > 0) || !(height > 0)) return false;
	store.fitToBounds({ x: minX, y: minY, width, height }, getViewportSize(), padding, {
		animate,
		durationMs,
	});
	return true;
}
