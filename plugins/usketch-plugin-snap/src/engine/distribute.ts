import type { BoundingBox } from "@edv4h/usketch-shared";
import type { GapSegment, SpacingGuide } from "./types.js";

type Axis = "x" | "y";

/** Along-axis + cross-axis accessors so the same logic serves X and Y. */
interface Access {
	min(b: BoundingBox): number;
	max(b: BoundingBox): number;
	size(b: BoundingBox): number;
	crossMin(b: BoundingBox): number;
	crossMax(b: BoundingBox): number;
}

const ACCESS: Record<Axis, Access> = {
	x: {
		min: (b) => b.x,
		max: (b) => b.x + b.width,
		size: (b) => b.width,
		crossMin: (b) => b.y,
		crossMax: (b) => b.y + b.height,
	},
	y: {
		min: (b) => b.y,
		max: (b) => b.y + b.height,
		size: (b) => b.height,
		crossMin: (b) => b.x,
		crossMax: (b) => b.x + b.width,
	},
};

export interface DistributeMatch {
	/** Delta to add to the moving box along the axis to reach equal spacing. */
	delta: number;
	guide: SpacingGuide;
}

const EPS = 1e-6;
/** Gaps within this many world units of each other count as "equal". */
const EQUAL_TOL = 0.5;

/**
 * Equal-spacing (distribution) snap for one axis. Considers only candidates whose
 * **cross-axis** extent overlaps the moving box (shapes "in the same row/column"),
 * measures the gaps between consecutive neighbors, then offers two behaviors:
 *
 * - **gap duplication** — replicate an existing gap length `L` on the outside of
 *   the row (drag a third box to sit `L` away → three equally spaced), and
 * - **gap center** — center the moving box inside a gap so both sides are equal.
 *
 * Returns the nearest match within `threshold` (world units), or `null`. The
 * returned guide highlights **all** gaps of the matched length so the equal
 * spacing reads at a glance.
 */
export function findDistributeSnap(
	movingBox: BoundingBox,
	candidateBoxes: ReadonlyMap<string, BoundingBox>,
	movingShapeIds: ReadonlySet<string>,
	threshold: number,
	axis: Axis,
): DistributeMatch | null {
	const a = ACCESS[axis];
	const mMin = a.min(movingBox);
	const mMax = a.max(movingBox);
	const mSize = a.size(movingBox);
	const mcMin = a.crossMin(movingBox);
	const mcMax = a.crossMax(movingBox);

	// Candidates in the same row/column: their cross extent overlaps the moving box.
	const row: BoundingBox[] = [];
	for (const [id, box] of candidateBoxes) {
		if (movingShapeIds.has(id)) continue;
		const overlap = Math.min(mcMax, a.crossMax(box)) - Math.max(mcMin, a.crossMin(box));
		if (overlap > 0) row.push(box);
	}
	if (row.length < 2) return null; // need a pair to form a reference gap
	row.sort((p, q) => a.min(p) - a.min(q));

	// Existing gaps between consecutive non-overlapping neighbors.
	interface Gap {
		lo: BoundingBox;
		hi: BoundingBox;
		length: number;
	}
	const gaps: Gap[] = [];
	for (let i = 0; i < row.length - 1; i++) {
		const lo = row[i];
		const hi = row[i + 1];
		const length = a.min(hi) - a.max(lo);
		if (length > EPS) gaps.push({ lo, hi, length });
	}
	if (gaps.length === 0) return null;

	// A gap segment: along-axis start/end + the cross-mid of the shared band
	// (clamped to the moving box so the tick sits where the eye expects it).
	const seg = (start: number, end: number, b1: BoundingBox, b2: BoundingBox): GapSegment => {
		const cLo = Math.max(a.crossMin(b1), a.crossMin(b2), mcMin);
		const cHi = Math.min(a.crossMax(b1), a.crossMax(b2), mcMax);
		const cross = cLo <= cHi ? (cLo + cHi) / 2 : (mcMin + mcMax) / 2;
		return { start, end, cross };
	};
	const existingSegsOfLength = (L: number): GapSegment[] =>
		gaps
			.filter((g) => Math.abs(g.length - L) <= EQUAL_TOL)
			.map((g) => seg(a.max(g.lo), a.min(g.hi), g.lo, g.hi));

	let best: DistributeMatch | null = null;
	const consider = (delta: number, guide: SpacingGuide) => {
		if (Math.abs(delta) > threshold + EPS) return;
		if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, guide };
	};

	// (1) Center-in-gap — center the moving box inside a gap ≥ its own size.
	for (const g of gaps) {
		if (g.length + EPS < mSize) continue;
		const gapStart = a.max(g.lo);
		const gapEnd = a.min(g.hi);
		const delta = (gapStart + gapEnd) / 2 - (mMin + mSize / 2);
		const side = (g.length - mSize) / 2; // equal gap on each side after centering
		const newMin = mMin + delta;
		const newMax = mMax + delta;
		consider(delta, {
			axis,
			length: side,
			segments: [seg(gapStart, newMin, g.lo, movingBox), seg(newMax, gapEnd, movingBox, g.hi)],
		});
	}

	// (2) Gap duplication — extend a gap of length L to the outside of the row.
	for (const g of gaps) {
		const L = g.length;
		const matches = existingSegsOfLength(L);
		// place moving to the RIGHT of the gap's hi box: gap(hi, moving) = L
		{
			const targetMin = a.max(g.hi) + L;
			consider(targetMin - mMin, {
				axis,
				length: L,
				segments: [...matches, seg(a.max(g.hi), targetMin, g.hi, movingBox)],
			});
		}
		// place moving to the LEFT of the gap's lo box: gap(moving, lo) = L
		{
			const targetMax = a.min(g.lo) - L;
			consider(targetMax - mMax, {
				axis,
				length: L,
				segments: [seg(targetMax, a.min(g.lo), movingBox, g.lo), ...matches],
			});
		}
	}

	return best;
}
