import type { ResizeHandle } from "@edv4h/usketch-shared";

/** Same window as the select tool's shape double-click. */
const DOUBLE_CLICK_MS = 400;

/**
 * Tracks pointer-downs on resize handles. Returns true when this press is the
 * second one on the same handle of the same shape within the double-click
 * window; a detected double-click resets, so a third press starts over.
 */
export function createHandleClickTracker(): (
	shapeId: string,
	handle: ResizeHandle,
	now: number,
) => boolean {
	let last: { shapeId: string; handle: ResizeHandle; time: number } | null = null;
	return (shapeId, handle, now) => {
		const isDouble =
			last !== null &&
			last.shapeId === shapeId &&
			last.handle === handle &&
			now - last.time < DOUBLE_CLICK_MS;
		last = isDouble ? null : { shapeId, handle, time: now };
		return isDouble;
	};
}
