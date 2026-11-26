import type { BoundingBox } from "@edv4h/usketch-shared";
import {
	type ActivityKeyframe,
	type ActivityMotion,
	MAX_MOTION_MS,
	type MotionPoint,
} from "./motion.js";

/**
 * Sender side of {@link ActivityMotion}: build "the cursor glides from shape to
 * shape, outlining each as it arrives" as one awareness value. The receiver side is
 * `sampleMotion`; this is its counterpart for whoever publishes the motion (a bot,
 * a server-side agent, a scripted demo, a replay).
 *
 * Pure and React-free, so a server can use it through the `/motion` entry point.
 */

/**
 * One place the cursor visits; `shapeIds` is the outline set shown on arrival. With
 * `move`, the cursor first goes to the shape's old box and then drags a ghost of it
 * to `move.to` (whose centre should be `cursor`).
 */
export interface MotionStop {
	cursor: MotionPoint;
	shapeIds?: string[];
	move?: { shapeId: string; from: BoundingBox; to: BoundingBox };
}

/** Default time for one cursor hop between stops. */
export const DEFAULT_MOTION_HOP_MS = 420;
/**
 * Default cap on a whole tour, so many stops speed up instead of dragging on. (The
 * MCP server's old builder called this `MAX_MOTION_MS`; that name here is the
 * receiver's hard limit, 60 s.)
 */
export const DEFAULT_MOTION_TOUR_MS = 2400;

export interface MotionTiming {
	/** Time for one hop (default {@link DEFAULT_MOTION_HOP_MS}). */
	hopMs?: number;
	/**
	 * Cap on the whole tour; hops shrink to fit (default {@link DEFAULT_MOTION_TOUR_MS}).
	 * Never more than the receivers' `MAX_MOTION_MS`, which they clamp times to.
	 */
	maxDurationMs?: number;
}

export interface BuildMotionOptions extends MotionTiming {
	/** Unique per motion; a new id restarts playback on receivers. */
	id: string;
	stops: readonly MotionStop[];
	/** Where the cursor rests now. Omitted (or null): the tour starts at the first stop. */
	from?: MotionPoint | null;
	/** Action shown with each stop's outline (default `"edit"`). */
	action?: "select" | "edit";
}

export const boxCenter = (b: BoundingBox): MotionPoint => ({
	x: b.x + b.width / 2,
	y: b.y + b.height / 2,
});

/** Cursor positions of a tour: a moved shape costs two (its old spot, then its new one). */
const pointCount = (stops: readonly MotionStop[]) =>
	stops.reduce((n, s) => n + (s.move ? 2 : 1), 0);

/** A non-negative finite length, else `fallback` (callers may be plain JS). */
const lengthOr = (v: number | undefined, fallback: number) =>
	typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;

function hopLength(
	stops: readonly MotionStop[],
	from: MotionPoint | null | undefined,
	timing: MotionTiming,
): number {
	const hopMs = lengthOr(timing.hopMs, DEFAULT_MOTION_HOP_MS);
	const tourMs = Math.min(lengthOr(timing.maxDurationMs, DEFAULT_MOTION_TOUR_MS), MAX_MOTION_MS);
	const hops = pointCount(stops) - (from ? 0 : 1);
	return hops > 0 ? Math.min(hopMs, tourMs / hops) : 0;
}

/**
 * Milliseconds after the start at which the cursor reaches each stop (and its
 * outline appears), in the same order as `stops`. Same timing as
 * {@link buildMotion}, so a sender can make each change in the doc as the cursor
 * gets there instead of all at once.
 */
export function motionStopTimes(
	stops: readonly MotionStop[],
	opts: MotionTiming & { from?: MotionPoint | null } = {},
): number[] {
	const hop = hopLength(stops, opts.from, opts);
	let step = opts.from ? 1 : 0;
	return stops.map((s) => {
		step += s.move ? 1 : 0;
		return Math.round(step++ * hop);
	});
}

/**
 * Cursor tour through `stops`, starting at `from` if known, else at the first stop.
 * Each stop's `shapeIds` become visible on arrival. Returns `null` when there is
 * nothing to move through.
 */
export function buildMotion(opts: BuildMotionOptions): ActivityMotion | null {
	const { id, stops, from, action = "edit" } = opts;
	if (stops.length === 0) return null;

	const hop = hopLength(stops, from, opts);
	const keyframes: ActivityKeyframe[] = [];
	let step = 0;
	const at = () => Math.round(step++ * hop);
	if (from) keyframes.push({ at: at(), cursor: from });
	for (const stop of stops) {
		if (stop.move) {
			const { shapeId, from: before } = stop.move;
			keyframes.push({ at: at(), cursor: boxCenter(before), moves: [{ shapeId, box: before }] });
		}
		keyframes.push({
			at: at(),
			cursor: stop.cursor,
			...(stop.shapeIds ? { shapeIds: stop.shapeIds, action } : {}),
			...(stop.move ? { moves: [{ shapeId: stop.move.shapeId, box: stop.move.to }] } : {}),
		});
	}
	return { id, keyframes, easing: "ease-in-out" };
}

const sameBox = (a: BoundingBox, b: BoundingBox) =>
	a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * Stops that visit each shape in order, outlining the shapes visited so far. A shape
 * with a `from` box different from its `box` is dragged there (see `MotionStop.move`).
 */
export function visitShapes(
	shapes: ReadonlyArray<{ id: string; box: BoundingBox; from?: BoundingBox }>,
): MotionStop[] {
	return shapes.map((s, i) => ({
		cursor: boxCenter(s.box),
		shapeIds: shapes.slice(0, i + 1).map((v) => v.id),
		...(s.from && !sameBox(s.from, s.box)
			? { move: { shapeId: s.id, from: s.from, to: s.box } }
			: {}),
	}));
}

/** Where the cursor ends up after a motion, if it moves one. */
export function motionFinalCursor(motion: ActivityMotion): MotionPoint | undefined {
	for (let i = motion.keyframes.length - 1; i >= 0; i--) {
		const c = motion.keyframes[i].cursor;
		if (c) return c;
	}
	return undefined;
}
