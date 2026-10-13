import type { BoundingBox } from "@edv4h/usketch-shared";

/** A world-space point (same shape as the awareness `cursor` field). */
export interface MotionPoint {
	x: number;
	y: number;
}

/**
 * One keyframe of an {@link ActivityMotion}. Every field except `at` is optional and
 * describes one "track"; a keyframe only changes the tracks it sets.
 *
 * - `cursor` / `marquee` are **interpolated** toward the next keyframe that sets them
 *   (`marquee: null` ends the rectangle, and is never interpolated into).
 * - `shapeIds` / `action` are **held** until the next keyframe that sets them.
 * - `moves` places a ghost of each listed shape; a shape's ghost is **interpolated**
 *   between consecutive keyframes that list it, and is shown only while it is
 *   between its first and last such keyframe (the real shape already sits at the
 *   destination in the doc, so the ghost replays the trip and then disappears).
 *
 * New tracks can be added later as further optional fields: receivers ignore keys
 * they don't know, so the schema stays backward compatible.
 */
export interface ActivityKeyframe {
	/** Milliseconds from the start of the motion. Keyframes are sorted by this. */
	at: number;
	cursor?: MotionPoint;
	shapeIds?: string[];
	marquee?: BoundingBox | null;
	action?: "select" | "edit";
	/** World bounds of shapes being moved, at this instant (see the class comment). */
	moves?: ShapeMove[];
}

/** One shape's position in a {@link ActivityKeyframe.moves} track. */
export interface ShapeMove {
	shapeId: string;
	box: BoundingBox;
}

/**
 * A continuous movement — "cursor glides to A, selects it, glides to B, edits it" —
 * expressed as ONE value on the awareness `activity` field, so it costs a single
 * awareness update and every receiver plays it back smoothly at its own frame rate.
 *
 * Receivers start the clock when they first see a given `id` (no clock sync between
 * peers needed), play the keyframes, then hold the final frame until the sender
 * clears `activity`. Publishing a new `id` restarts playback.
 */
export interface ActivityMotion {
	/** Unique per motion; a change restarts playback on receivers. */
	id: string;
	keyframes: ActivityKeyframe[];
	/** Easing for interpolated tracks between two keyframes (default `"ease-in-out"`). */
	easing?: "linear" | "ease-in-out";
}

/** What a motion looks like at one instant. */
export interface ActivityFrame {
	cursor?: MotionPoint;
	shapeIds: string[];
	marquee?: BoundingBox;
	action: "select" | "edit";
	/** Ghosts of shapes currently in transit (world bounds). */
	ghosts: ShapeMove[];
	/** `true` once playback has reached the last keyframe (the final frame is held). */
	done: boolean;
}

/** Upper bounds so a malformed/hostile peer can't make every receiver do unbounded work. */
export const MAX_KEYFRAMES = 256;
export const MAX_MOTION_MS = 60_000;
export const MAX_MOVES_PER_KEYFRAME = 64;

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function readPoint(v: unknown): MotionPoint | undefined {
	if (!v || typeof v !== "object") return undefined;
	const { x, y } = v as Record<string, unknown>;
	return isFiniteNumber(x) && isFiniteNumber(y) ? { x, y } : undefined;
}

function readBox(v: unknown): BoundingBox | undefined {
	if (!v || typeof v !== "object") return undefined;
	const { x, y, width, height } = v as Record<string, unknown>;
	return isFiniteNumber(x) && isFiniteNumber(y) && isFiniteNumber(width) && isFiniteNumber(height)
		? { x, y, width, height }
		: undefined;
}

/**
 * Validate a motion received over awareness (untrusted peer data). Drops malformed
 * keyframes and fields, clamps times to `[0, MAX_MOTION_MS]`, caps the keyframe
 * count and sorts by `at`. Returns `null` when nothing playable remains.
 */
export function normalizeMotion(raw: unknown): ActivityMotion | null {
	if (!raw || typeof raw !== "object") return null;
	const { id, keyframes, easing } = raw as Record<string, unknown>;
	if (typeof id !== "string" || id === "" || !Array.isArray(keyframes)) return null;

	const out: ActivityKeyframe[] = [];
	for (const k of keyframes.slice(0, MAX_KEYFRAMES)) {
		if (!k || typeof k !== "object") continue;
		const r = k as Record<string, unknown>;
		if (!isFiniteNumber(r.at)) continue;
		const kf: ActivityKeyframe = { at: Math.min(Math.max(r.at, 0), MAX_MOTION_MS) };
		const cursor = readPoint(r.cursor);
		if (cursor) kf.cursor = cursor;
		if (Array.isArray(r.shapeIds)) {
			kf.shapeIds = r.shapeIds.filter((s): s is string => typeof s === "string");
		}
		if (r.marquee === null) kf.marquee = null;
		else {
			const box = readBox(r.marquee);
			if (box) kf.marquee = box;
		}
		if (r.action === "select" || r.action === "edit") kf.action = r.action;
		if (Array.isArray(r.moves)) {
			const moves: ShapeMove[] = [];
			for (const m of r.moves.slice(0, MAX_MOVES_PER_KEYFRAME)) {
				const shapeId = (m as Record<string, unknown> | null)?.shapeId;
				const box = readBox((m as Record<string, unknown> | null)?.box);
				if (typeof shapeId === "string" && box) moves.push({ shapeId, box });
			}
			if (moves.length > 0) kf.moves = moves;
		}
		out.push(kf);
	}
	if (out.length === 0) return null;
	// Stable sort keeps the sender's order for keyframes sharing the same `at`.
	out.sort((a, b) => a.at - b.at);
	return { id, keyframes: out, easing: easing === "linear" ? "linear" : "ease-in-out" };
}

/** Total length of a motion in ms (the `at` of its last keyframe). */
export function motionDuration(motion: ActivityMotion): number {
	return motion.keyframes.reduce((max, k) => Math.max(max, k.at), 0);
}

const lerpBox = (a: BoundingBox, b: BoundingBox, p: number): BoundingBox => ({
	x: lerp(a.x, b.x, p),
	y: lerp(a.y, b.y, p),
	width: lerp(a.width, b.width, p),
	height: lerp(a.height, b.height, p),
});

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Interpolated value of one track at `elapsed`: the last keyframe at/before it that
 * sets the track, blended toward the next one that sets it to a non-null value.
 */
function sampleTrack<T>(
	keyframes: readonly ActivityKeyframe[],
	elapsed: number,
	pick: (k: ActivityKeyframe) => T | null | undefined,
	blend: (a: T, b: T, t: number) => T,
	ease: (t: number) => number,
): T | undefined {
	let prev: ActivityKeyframe | undefined;
	let next: ActivityKeyframe | undefined;
	for (const k of keyframes) {
		if (pick(k) === undefined) continue;
		if (k.at <= elapsed) prev = k;
		else {
			next = k;
			break;
		}
	}
	if (!prev) return undefined;
	const a = pick(prev);
	if (a === null || a === undefined) return undefined;
	const b = next ? pick(next) : undefined;
	if (!next || b === null || b === undefined || next.at === prev.at) return a;
	return blend(a, b, ease((elapsed - prev.at) / (next.at - prev.at)));
}

/** Held (step) value of one track at `elapsed`. */
function holdTrack<T>(
	keyframes: readonly ActivityKeyframe[],
	elapsed: number,
	pick: (k: ActivityKeyframe) => T | undefined,
): T | undefined {
	let value: T | undefined;
	for (const k of keyframes) {
		if (k.at > elapsed) break;
		const v = pick(k);
		if (v !== undefined) value = v;
	}
	return value;
}

/**
 * Ghost of every shape in the `moves` track that is mid-trip at `elapsed`: past its
 * first keyframe and before its last one, interpolated between the two around it.
 */
function sampleGhosts(
	keyframes: readonly ActivityKeyframe[],
	elapsed: number,
	ease: (t: number) => number,
): ShapeMove[] {
	const tracks = new Map<string, Array<{ at: number; box: BoundingBox }>>();
	for (const k of keyframes) {
		for (const m of k.moves ?? []) {
			const track = tracks.get(m.shapeId) ?? [];
			track.push({ at: k.at, box: m.box });
			tracks.set(m.shapeId, track);
		}
	}
	const ghosts: ShapeMove[] = [];
	for (const [shapeId, track] of tracks) {
		const last = track[track.length - 1];
		if (elapsed < track[0].at || elapsed >= last.at) continue;
		let i = 0;
		while (track[i + 1].at <= elapsed) i++;
		const a = track[i];
		const b = track[i + 1];
		const p = b.at === a.at ? 1 : ease((elapsed - a.at) / (b.at - a.at));
		ghosts.push({ shapeId, box: lerpBox(a.box, b.box, p) });
	}
	return ghosts;
}

/**
 * Sample a motion `elapsed` ms after playback started. Pure: same inputs, same
 * frame. Past the end it returns the final frame with `done: true`.
 */
export function sampleMotion(motion: ActivityMotion, elapsed: number): ActivityFrame {
	const { keyframes } = motion;
	const t = Math.max(0, elapsed);
	const ease = motion.easing === "linear" ? (x: number) => x : easeInOut;

	const cursor = sampleTrack<MotionPoint>(
		keyframes,
		t,
		(k) => k.cursor,
		(a, b, p) => ({ x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p) }),
		ease,
	);
	const marquee = sampleTrack<BoundingBox>(keyframes, t, (k) => k.marquee, lerpBox, ease);

	return {
		cursor,
		shapeIds: holdTrack(keyframes, t, (k) => k.shapeIds) ?? [],
		marquee,
		action: holdTrack(keyframes, t, (k) => k.action) ?? "edit",
		ghosts: sampleGhosts(keyframes, t, ease),
		done: t >= motionDuration(motion),
	};
}

/**
 * Per-receiver playback clock: remembers when each participant's current motion was
 * first seen, so `elapsed()` is measured on THIS client's clock (no cross-peer clock
 * sync). Seeing a new motion `id` for a participant restarts its clock.
 */
export interface MotionClock {
	/** Elapsed ms of `motionId` for `clientId`, starting its clock if new. */
	elapsed(clientId: number, motionId: string): number;
	/** Forget participants not in `active` (no motion any more / left the board). */
	prune(active: ReadonlySet<number>): void;
}

export function createMotionClock(now: () => number = () => performance.now()): MotionClock {
	const started = new Map<number, { id: string; at: number }>();
	return {
		elapsed(clientId, motionId) {
			const t = now();
			const s = started.get(clientId);
			if (!s || s.id !== motionId) {
				started.set(clientId, { id: motionId, at: t });
				return 0;
			}
			return t - s.at;
		},
		prune(active) {
			for (const id of started.keys()) if (!active.has(id)) started.delete(id);
		},
	};
}
