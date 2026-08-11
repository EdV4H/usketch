import type { BoundingBox } from "@edv4h/usketch-shared";
import { DEFAULT_SNAP_THRESHOLD } from "../constants.js";
import { findDistributeSnap } from "./distribute.js";
import { extractSnapPoints } from "./snap-points.js";
import type {
	SnapEdge,
	SnapIndicator,
	SnapLine,
	SnapPoint,
	SnapResult,
	SnapSettings,
	SpacingGuide,
} from "./types.js";

export interface SnapEdgeFilter {
	/** Restrict X-axis snap to only these edges of the moving box */
	xEdges?: SnapEdge[];
	/** Restrict Y-axis snap to only these edges of the moving box */
	yEdges?: SnapEdge[];
}

export function calculateSnap(
	movingBox: BoundingBox,
	movingShapeIds: ReadonlySet<string>,
	candidateBoxes: ReadonlyMap<string, BoundingBox>,
	settings: SnapSettings,
	movingSnapOverrides?: Pick<SnapSettings, "edgeSnap" | "centerSnap">,
	edgeFilter?: SnapEdgeFilter,
): SnapResult {
	if (!settings.enabled) {
		return { dx: 0, dy: 0, xEdge: null, yEdge: null, lines: [], gaps: [] };
	}

	const threshold = settings.threshold ?? DEFAULT_SNAP_THRESHOLD;
	const movingSnapSettings = movingSnapOverrides ?? settings;

	// Extract snap points from the moving shape(s)' combined bounding box
	const moving = extractSnapPoints(movingBox, "__moving__", movingSnapSettings);

	// Filter moving snap points to only the edges being dragged (during resize)
	if (edgeFilter?.xEdges) {
		const allowed = new Set(edgeFilter.xEdges);
		moving.xPoints = moving.xPoints.filter((p) => allowed.has(p.edge));
	}
	if (edgeFilter?.yEdges) {
		const allowed = new Set(edgeFilter.yEdges);
		moving.yPoints = moving.yPoints.filter((p) => allowed.has(p.edge));
	}

	// Collect candidate snap points from all non-moving shapes
	const candidateX: SnapPoint[] = [];
	const candidateY: SnapPoint[] = [];
	for (const [id, box] of candidateBoxes) {
		if (movingShapeIds.has(id)) continue;
		const pts = extractSnapPoints(box, id, settings);
		candidateX.push(...pts.xPoints);
		candidateY.push(...pts.yPoints);
	}

	// Alignment (edge/center) snaps per axis
	const xSnap = findBestSnap(moving.xPoints, candidateX, threshold);
	const ySnap = findBestSnap(moving.yPoints, candidateY, threshold);

	// Equal-spacing (distribution) snaps — a move-only concept, so it is disabled
	// during a real resize: only when the caller actually restricts snap edges
	// (`xEdges`/`yEdges`), not merely because an (empty) filter object was passed.
	// `distributeSnap` undefined counts as on (only an explicit `false` disables it).
	const isResize = edgeFilter?.xEdges !== undefined || edgeFilter?.yEdges !== undefined;
	const distEnabled = settings.distributeSnap !== false && !isResize;
	const distX = distEnabled
		? findDistributeSnap(movingBox, candidateBoxes, movingShapeIds, threshold, "x")
		: null;
	const distY = distEnabled
		? findDistributeSnap(movingBox, candidateBoxes, movingShapeIds, threshold, "y")
		: null;

	// Per axis, prefer whichever snap (alignment vs distribution) is nearer.
	const xUseDist = distX !== null && (xSnap === null || Math.abs(distX.delta) < Math.abs(xSnap.dx));
	const yUseDist = distY !== null && (ySnap === null || Math.abs(distY.delta) < Math.abs(ySnap.dx));

	// Build guide lines / gap guides with indicators
	const lines: SnapLine[] = [];
	const gaps: SpacingGuide[] = [];
	const snapDx = xUseDist && distX ? distX.delta : (xSnap?.dx ?? 0);
	const snapDy = yUseDist && distY ? distY.delta : (ySnap?.dx ?? 0);

	// Snapped moving box position
	const snappedMoving = {
		x: movingBox.x + snapDx,
		y: movingBox.y + snapDy,
		width: movingBox.width,
		height: movingBox.height,
	};

	if (xUseDist && distX) {
		gaps.push(distX.guide);
	} else if (xSnap) {
		lines.push(buildAlignmentLine("x", xSnap, candidateX, candidateBoxes, snappedMoving));
	}

	if (yUseDist && distY) {
		gaps.push(distY.guide);
	} else if (ySnap) {
		lines.push(buildAlignmentLine("y", ySnap, candidateY, candidateBoxes, snappedMoving));
	}

	return {
		dx: snapDx,
		dy: snapDy,
		xEdge: xUseDist ? null : (xSnap?.moving.edge ?? null),
		yEdge: yUseDist ? null : (ySnap?.moving.edge ?? null),
		lines,
		gaps,
	};
}

interface SnapMatch {
	dx: number;
	moving: SnapPoint;
	candidate: SnapPoint;
}

function findBestSnap(
	movingPoints: SnapPoint[],
	candidatePoints: SnapPoint[],
	threshold: number,
): SnapMatch | null {
	let best: SnapMatch | null = null;
	let bestDist = threshold;

	for (const mp of movingPoints) {
		for (const cp of candidatePoints) {
			const dist = Math.abs(mp.value - cp.value);
			if (dist <= bestDist) {
				bestDist = dist;
				best = { dx: cp.value - mp.value, moving: mp, candidate: cp };
			}
		}
	}

	return best;
}

/** Candidates whose value equals the winning value (modulo float error) are on
 *  the same snap line. A tiny epsilon — NOT a visible distance — so only shapes
 *  that truly share the snapped value are aggregated. */
const ALIGN_EPS = 1e-6;

/**
 * Build one alignment guide line for a winning snap. Instead of reflecting only
 * the single nearest candidate, this gathers EVERY candidate shape whose snap
 * point lies on the same line (value within {@link ALIGN_EPS}), extends the line
 * to span them all, and draws indicators on each. So three shapes sharing an edge
 * show one continuous line touching all three — not just the first/nearest one.
 */
function buildAlignmentLine(
	axis: "x" | "y",
	snap: SnapMatch,
	candidatePoints: SnapPoint[],
	candidateBoxes: ReadonlyMap<string, BoundingBox>,
	snappedMoving: BoundingBox,
): SnapLine {
	const position = snap.candidate.value;
	// Cross-axis extent: a vertical line (axis="x") spans y; a horizontal one spans x.
	let from = axis === "x" ? snappedMoving.y : snappedMoving.x;
	let to =
		axis === "x" ? snappedMoving.y + snappedMoving.height : snappedMoving.x + snappedMoving.width;
	const indicators: SnapIndicator[] = [
		...edgeIndicators(position, snappedMoving, axis, snap.moving.edge),
	];

	const seen = new Set<string>();
	for (const cp of candidatePoints) {
		if (Math.abs(cp.value - position) > ALIGN_EPS) continue;
		const box = candidateBoxes.get(cp.sourceShapeId);
		if (!box) continue;
		from = Math.min(from, axis === "x" ? box.y : box.x);
		to = Math.max(to, axis === "x" ? box.y + box.height : box.x + box.width);
		const key = `${cp.sourceShapeId}:${cp.edge}`;
		if (seen.has(key)) continue;
		seen.add(key);
		indicators.push(...edgeIndicators(position, box, axis, cp.edge));
	}

	return {
		axis,
		position,
		from,
		to,
		movingEdge: snap.moving.edge,
		candidateEdge: snap.candidate.edge,
		indicators,
	};
}

/**
 * Generate indicators for a snap on a given box.
 * - Edge snap (min/max): two dots at both corners of that edge
 * - Center snap: one diamond at the center point
 *
 * `snapAxis` is the axis of the snap line ("x" for vertical, "y" for horizontal).
 * For a vertical snap line (axis="x"), the snapped edge is an x-edge,
 * and the cross axis (y) gives the two corner positions.
 */
function edgeIndicators(
	snapPosition: number,
	box: BoundingBox,
	snapAxis: "x" | "y",
	edge: SnapPoint["edge"],
): SnapIndicator[] {
	if (edge === "center") {
		// Single diamond at center
		const cx = snapAxis === "x" ? snapPosition : box.x + box.width / 2;
		const cy = snapAxis === "y" ? snapPosition : box.y + box.height / 2;
		return [{ x: cx, y: cy, edge }];
	}
	// Two dots at both ends of the edge
	if (snapAxis === "x") {
		// Vertical guide: x is fixed, y varies along the box's height
		return [
			{ x: snapPosition, y: box.y, edge },
			{ x: snapPosition, y: box.y + box.height, edge },
		];
	}
	// Horizontal guide: y is fixed, x varies along the box's width
	return [
		{ x: box.x, y: snapPosition, edge },
		{ x: box.x + box.width, y: snapPosition, edge },
	];
}
