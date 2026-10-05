// Pure math for two-pointer (pinch/2-finger-pan) gestures, split out of the Canvas
// component so it can be unit-tested without the DOM. All points are in
// container-relative screen coordinates.

export interface PointerSample {
	x: number;
	y: number;
}

/** Euclidean distance between two pointers. */
export function pointerDistance(a: PointerSample, b: PointerSample): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Midpoint of two pointers (the pinch centre / pan anchor). */
export function pointerMidpoint(a: PointerSample, b: PointerSample): PointerSample {
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export interface GestureStep {
	/** Zoom multiplier for this step (nextDistance / prevDistance; 1 when unchanged). */
	scale: number;
	/** Pan delta in screen pixels (how far the midpoint moved). */
	panX: number;
	panY: number;
	/** Current pinch centre (screen coords) — the zoom anchor. */
	centerX: number;
	centerY: number;
}

/**
 * One frame of a two-pointer gesture: the zoom multiplier (distance ratio), the
 * pan delta (midpoint movement) and the current pinch centre. Feed the previous
 * and current positions of the SAME two pointers. `scale` is 1 when the previous
 * distance is degenerate (both pointers coincident), so a bad frame is a no-op.
 */
export function gestureStep(
	prevA: PointerSample,
	prevB: PointerSample,
	nextA: PointerSample,
	nextB: PointerSample,
): GestureStep {
	const prevDist = pointerDistance(prevA, prevB);
	const nextDist = pointerDistance(nextA, nextB);
	const prevMid = pointerMidpoint(prevA, prevB);
	const nextMid = pointerMidpoint(nextA, nextB);
	return {
		scale: prevDist > 0 ? nextDist / prevDist : 1,
		panX: nextMid.x - prevMid.x,
		panY: nextMid.y - prevMid.y,
		centerX: nextMid.x,
		centerY: nextMid.y,
	};
}
