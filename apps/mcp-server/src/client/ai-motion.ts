/**
 * Builds the AI participant's `activity.motion` (feature #960): one awareness value
 * describing a continuous movement — the AI cursor gliding from shape to shape,
 * outlining each as it arrives — that the web overlay plays back smoothly.
 *
 * The shape mirrors `ActivityMotion` in `@edv4h/usketch-plugin-presence-activity`
 * (an ad-hoc awareness convention, like the rest of `activity`; the MCP server does
 * not depend on the plugin).
 */

export interface Point {
	x: number;
	y: number;
}

export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface AiMotionKeyframe {
	at: number;
	cursor?: Point;
	shapeIds?: string[];
	action?: "select" | "edit";
}

export interface AiMotion {
	id: string;
	keyframes: AiMotionKeyframe[];
	easing?: "linear" | "ease-in-out";
}

/** One place the cursor visits; `shapeIds` is the outline set shown on arrival. */
export interface MotionStop {
	cursor: Point;
	shapeIds?: string[];
}

/** Time for one cursor hop between stops. */
export const HOP_MS = 420;
/** Cap on the whole motion, so many stops speed up instead of dragging on. */
export const MAX_MOTION_MS = 2400;

export const centerOf = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/**
 * Cursor path through `stops`, starting at `from` (where the AI cursor last was) if
 * known, else at the first stop. Each stop's `shapeIds` become visible on arrival.
 * Returns `null` when there is nothing to move through.
 */
export function buildAiMotion(opts: {
	id: string;
	stops: readonly MotionStop[];
	from?: Point;
	action?: "select" | "edit";
}): AiMotion | null {
	const { id, stops, from, action = "edit" } = opts;
	if (stops.length === 0) return null;

	const hops = from ? stops.length : stops.length - 1;
	const hop = hops > 0 ? Math.min(HOP_MS, MAX_MOTION_MS / hops) : 0;
	const keyframes: AiMotionKeyframe[] = [];
	if (from) keyframes.push({ at: 0, cursor: from });
	stops.forEach((stop, i) => {
		const at = Math.round((from ? i + 1 : i) * hop);
		keyframes.push({
			at,
			cursor: stop.cursor,
			...(stop.shapeIds ? { shapeIds: stop.shapeIds, action } : {}),
		});
	});
	return { id, keyframes, easing: "ease-in-out" };
}

/** Stops that visit each shape in order, outlining the shapes visited so far. */
export function visitShapes(shapes: ReadonlyArray<{ id: string; box: Box }>): MotionStop[] {
	return shapes.map((s, i) => ({
		cursor: centerOf(s.box),
		shapeIds: shapes.slice(0, i + 1).map((v) => v.id),
	}));
}

/** Duration of a motion (the `at` of its last keyframe). */
export function aiMotionDuration(motion: AiMotion): number {
	return motion.keyframes.reduce((max, k) => Math.max(max, k.at), 0);
}

/** Final cursor position of a motion, if it moves one. */
export function finalCursor(motion: AiMotion): Point | undefined {
	for (let i = motion.keyframes.length - 1; i >= 0; i--) {
		const c = motion.keyframes[i].cursor;
		if (c) return c;
	}
	return undefined;
}
