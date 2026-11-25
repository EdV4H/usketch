import type { BoundingBox, Point } from "@edv4h/usketch-shared";
import type { SizeGuide } from "./types.js";

/** Which edge of the box moves on one axis during a resize (`null`: that side's size isn't changing). */
export type ResizeEdge = "min" | "max" | null;

export interface ResizeEdges {
	x: ResizeEdge;
	y: ResizeEdge;
}

/** A shape whose width / height the resized shape can match. */
export interface SizeCandidate {
	id: string;
	width: number;
	height: number;
}

export interface SizeSnapInput {
	/** Width / height after the resize (and any alignment snap). */
	width: number;
	height: number;
	/** The edges the resize moves. */
	edges: ResizeEdges;
	/**
	 * Axes an alignment (edge) snap already fixed: their size stays as it is and
	 * only the other axis may be size-snapped (alignment wins).
	 */
	lockX?: boolean;
	lockY?: boolean;
	/** Shapes to match the size of (empty: square snap only). */
	candidates: readonly SizeCandidate[];
	threshold: number;
}

export interface SizeSnapMatch {
	width: number;
	height: number;
	/** Width and height were snapped to be equal. */
	square: boolean;
	/** Candidates whose width equals the snapped width (an equal-width snap happened). */
	sameWidth: string[];
	/** Candidates whose height equals the snapped height (an equal-height snap happened). */
	sameHeight: string[];
}

/** Sizes within this are "the same" (float error, not a visible distance). */
const SIZE_EPS = 1e-6;

/**
 * Square snapping is skipped below `threshold × this`: at the start of a drawing
 * drag every tiny box is within the threshold of a square, so the guide would flash.
 */
const MIN_SQUARE_FACTOR = 2;

interface AxisMatch {
	value: number;
	dist: number;
}

function nearestSize(
	size: number,
	candidates: readonly SizeCandidate[],
	key: "width" | "height",
	threshold: number,
): AxisMatch | null {
	let best: AxisMatch | null = null;
	for (const c of candidates) {
		const value = c[key];
		if (!(value > 0)) continue;
		const dist = Math.abs(value - size);
		if (dist <= threshold && (best === null || dist < best.dist)) best = { value, dist };
	}
	return best;
}

/**
 * Size snapping for a resize: make width and height equal (a square) when they
 * are within `threshold` of each other, or match the width / height of another
 * shape. Only the axes the resize moves (and alignment hasn't fixed) change.
 *
 * - Both axes free (a corner): the square meets the pointer halfway
 *   (`(w + h) / 2`) unless an equal-size match is nearer; when only one axis
 *   matches another shape's size, the other may still square up to it.
 * - One axis free (an edge handle, or a corner whose other axis is aligned):
 *   that axis becomes the other one's length or another shape's, whichever is nearer
 *   (a tie goes to the square).
 *
 * Returns `null` when nothing is within reach.
 */
export function findSizeSnap(input: SizeSnapInput): SizeSnapMatch | null {
	const { width: w, height: h, edges, candidates, threshold } = input;
	const freeX = edges.x !== null && !input.lockX;
	const freeY = edges.y !== null && !input.lockY;
	if (!freeX && !freeY) return null;

	const minSquare = threshold * MIN_SQUARE_FACTOR;
	const canSquare = (size: number) => Math.abs(w - h) <= threshold && size >= minSquare;
	const ex = freeX ? nearestSize(w, candidates, "width", threshold) : null;
	const ey = freeY ? nearestSize(h, candidates, "height", threshold) : null;

	let width = w;
	let height = h;
	let square = false;
	let snappedX = false;
	let snappedY = false;

	if (freeX && freeY) {
		const s = (w + h) / 2;
		const d = Math.abs(w - h) / 2;
		if (canSquare(s) && (!ex || d <= ex.dist) && (!ey || d <= ey.dist)) {
			width = s;
			height = s;
			square = true;
		} else {
			if (ex) {
				width = ex.value;
				snappedX = true;
			}
			if (ey) {
				height = ey.value;
				snappedY = true;
			}
			// One side took another shape's size: the other may square up to it.
			if (snappedX && !snappedY && Math.abs(width - h) <= threshold && width >= minSquare) {
				height = width;
				square = true;
			} else if (
				snappedY &&
				!snappedX &&
				Math.abs(height - w) <= threshold &&
				height >= minSquare
			) {
				width = height;
				square = true;
			}
		}
	} else if (freeX) {
		if (canSquare(h) && (!ex || Math.abs(w - h) <= ex.dist)) {
			width = h;
			square = true;
		} else if (ex) {
			width = ex.value;
			snappedX = true;
		}
	} else {
		if (canSquare(w) && (!ey || Math.abs(h - w) <= ey.dist)) {
			height = w;
			square = true;
		} else if (ey) {
			height = ey.value;
			snappedY = true;
		}
	}

	if (!square && !snappedX && !snappedY) return null;

	const sameAs = (key: "width" | "height", size: number) =>
		candidates.filter((c) => Math.abs(c[key] - size) <= SIZE_EPS).map((c) => c.id);
	return {
		width,
		height,
		square,
		sameWidth: snappedX ? sameAs("width", width) : [],
		sameHeight: snappedY ? sameAs("height", height) : [],
	};
}

/** The shape's local axes on the board: `u` along its width, `v` along its height. */
function localAxes(rotationDeg: number): { u: Point; v: Point } {
	const rad = (rotationDeg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return { u: { x: cos, y: sin }, v: { x: -sin, y: cos } };
}

const EDGE_EPS = 0.001;

/**
 * Which edges a resize moves, from the box before and after it, measured along
 * the shape's own (possibly rotated) axes. A side whose size doesn't change
 * gives `null`; when both of its edges move (rare), the max edge is reported.
 */
export function getResizeEdges(
	before: BoundingBox,
	after: BoundingBox,
	rotationDeg = 0,
): ResizeEdges {
	const { u, v } = localAxes(rotationDeg);
	const extent = (b: BoundingBox, axis: Point, size: number) => {
		const c = (b.x + b.width / 2) * axis.x + (b.y + b.height / 2) * axis.y;
		return { min: c - size / 2, max: c + size / 2 };
	};
	const pick = (b0: { min: number; max: number }, b1: { min: number; max: number }) => {
		if (Math.abs(b1.max - b0.max) > EDGE_EPS) return "max" as const;
		if (Math.abs(b1.min - b0.min) > EDGE_EPS) return "min" as const;
		return null;
	};
	return {
		x: pick(extent(before, u, before.width), extent(after, u, after.width)),
		y: pick(extent(before, v, before.height), extent(after, v, after.height)),
	};
}

/**
 * Give a resized box a new width / height while the edges the resize doesn't
 * move stay where they are on the board (along the shape's turned axes when
 * rotated). Returns the store `x` / `y` / `width` / `height`.
 */
export function resizeKeepingAnchor(
	box: BoundingBox,
	edges: ResizeEdges,
	width: number,
	height: number,
	rotationDeg = 0,
): BoundingBox {
	const { u, v } = localAxes(rotationDeg);
	const du = edges.x === "min" ? -(width - box.width) / 2 : (width - box.width) / 2;
	const dv = edges.y === "min" ? -(height - box.height) / 2 : (height - box.height) / 2;
	const cx = box.x + box.width / 2 + u.x * du + v.x * dv;
	const cy = box.y + box.height / 2 + u.y * du + v.y * dv;
	return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** The four corners of a (possibly rotated) box: top-left, top-right, bottom-right, bottom-left. */
function corners(box: BoundingBox, rotationDeg: number): [Point, Point, Point, Point] {
	const { u, v } = localAxes(rotationDeg);
	const cx = box.x + box.width / 2;
	const cy = box.y + box.height / 2;
	const at = (su: number, sv: number): Point => ({
		x: cx + u.x * su * (box.width / 2) + v.x * sv * (box.height / 2),
		y: cy + u.y * su * (box.width / 2) + v.y * sv * (box.height / 2),
	});
	return [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)];
}

/**
 * Guides for a size snap on the snapped `box`: a diagonal through the dragged
 * corner for a square, and a dimension bar on the resized shape and every
 * shape it now matches for an equal width / height.
 */
export function buildSizeGuides(
	box: BoundingBox,
	edges: ResizeEdges,
	match: SizeSnapMatch,
	candidateBoxes: ReadonlyMap<string, BoundingBox>,
	rotationDeg = 0,
): SizeGuide[] {
	const guides: SizeGuide[] = [];
	if (match.square) {
		const [tl, tr, br, bl] = corners(box, rotationDeg);
		// The diagonal through the corner being dragged and the one anchored
		// opposite it (nw/se → TL–BR, ne/sw → TR–BL; an edge handle uses TL–BR).
		const falling = edges.x === null || edges.y === null || edges.x === edges.y;
		guides.push(
			falling ? { kind: "square", from: tl, to: br } : { kind: "square", from: tr, to: bl },
		);
	}
	const dimension = (axis: "x" | "y", ids: string[]) => {
		const boxes = [box, ...ids.flatMap((id) => candidateBoxes.get(id) ?? [])];
		guides.push({
			kind: "dimension",
			axis,
			segments: boxes.map((b) =>
				axis === "x"
					? { start: b.x, end: b.x + b.width, cross: b.y }
					: { start: b.y, end: b.y + b.height, cross: b.x },
			),
		});
	};
	if (match.sameWidth.length > 0) dimension("x", match.sameWidth);
	if (match.sameHeight.length > 0) dimension("y", match.sameHeight);
	return guides;
}
