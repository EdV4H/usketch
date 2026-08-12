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

/**
 * Move the camera to a start position. Returns `false` when it can't be resolved
 * — currently only a `shape` start whose shape was deleted — so callers can fall
 * back (e.g. frame all content, or do nothing).
 */
export function applyStartPosition(
	store: BoardStore,
	start: StartPosition,
	opts: ApplyOptions = {},
): boolean {
	const { animate = false, durationMs } = opts;
	switch (start.kind) {
		case "coordinate":
			// Keep the viewer's current zoom; only recenter.
			centerOnWorld(store, { x: start.x, y: start.y }, { animate, durationMs });
			return true;
		case "viewport":
			centerOnWorld(store, { x: start.x, y: start.y }, { zoom: start.zoom, animate, durationMs });
			return true;
		case "shape": {
			const s = store.getShape(start.shapeId);
			if (!s) return false;
			const aabb = getRotatedAABB(
				{ x: s.x, y: s.y, width: s.width, height: s.height },
				safeRotation(s.rotation),
			);
			store.fitToBounds(aabb, getScreenSize(), start.padding ?? 80, { animate, durationMs });
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
