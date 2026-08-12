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
import type { StartPosition } from "./start-position-shape.js";

export interface ApplyOptions {
	animate?: boolean;
	durationMs?: number;
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
	const { animate = false, durationMs } = opts;
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
			store.fitToBounds(aabb, getScreenSize(), padding, { animate, durationMs });
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
