import type { BoundingBox } from "@edv4h/usketch-shared";
import { DEFAULT_SNAP_THRESHOLD } from "../constants.js";
import { extractSnapPoints } from "./snap-points.js";
import type { SnapIndicator, SnapLine, SnapPoint, SnapResult, SnapSettings } from "./types.js";

export function calculateSnap(
	movingBox: BoundingBox,
	movingShapeIds: ReadonlySet<string>,
	candidateBoxes: ReadonlyMap<string, BoundingBox>,
	settings: SnapSettings,
	movingSnapOverrides?: Pick<SnapSettings, "edgeSnap" | "centerSnap">,
): SnapResult {
	if (!settings.enabled) {
		return { dx: 0, dy: 0, lines: [] };
	}

	const threshold = settings.threshold ?? DEFAULT_SNAP_THRESHOLD;
	const movingSnapSettings = movingSnapOverrides ?? settings;

	// Extract snap points from the moving shape(s)' combined bounding box
	const moving = extractSnapPoints(movingBox, "__moving__", movingSnapSettings);

	// Collect candidate snap points from all non-moving shapes
	const candidateX: SnapPoint[] = [];
	const candidateY: SnapPoint[] = [];
	for (const [id, box] of candidateBoxes) {
		if (movingShapeIds.has(id)) continue;
		const pts = extractSnapPoints(box, id, settings);
		candidateX.push(...pts.xPoints);
		candidateY.push(...pts.yPoints);
	}

	// Find best snap for each axis independently
	const xSnap = findBestSnap(moving.xPoints, candidateX, threshold);
	const ySnap = findBestSnap(moving.yPoints, candidateY, threshold);

	// Build guide lines with indicators
	const lines: SnapLine[] = [];
	const snapDx = xSnap?.dx ?? 0;
	const snapDy = ySnap?.dx ?? 0;

	// Snapped moving box position
	const snappedMoving = {
		x: movingBox.x + snapDx,
		y: movingBox.y + snapDy,
		width: movingBox.width,
		height: movingBox.height,
	};

	if (xSnap) {
		const position = xSnap.candidate.value;
		const yExtent = computeExtent(
			snappedMoving.y,
			snappedMoving.y + snappedMoving.height,
			candidateBoxes,
			movingShapeIds,
			xSnap.candidate.sourceShapeId,
			"y",
		);
		// Indicators on the vertical guide line (x fixed, y varies)
		// Edge snap: show dots at both ends of the edge
		// Center snap: show diamond at center point
		const indicators: SnapIndicator[] = [
			...edgeIndicators(position, snappedMoving, "x", xSnap.moving.edge),
			...edgeIndicatorsFromBox(
				position,
				candidateBoxes.get(xSnap.candidate.sourceShapeId),
				"x",
				xSnap.candidate.edge,
			),
		];
		lines.push({
			axis: "x",
			position,
			from: yExtent.min,
			to: yExtent.max,
			movingEdge: xSnap.moving.edge,
			candidateEdge: xSnap.candidate.edge,
			indicators,
		});
	}

	if (ySnap) {
		const position = ySnap.candidate.value;
		const xExtent = computeExtent(
			snappedMoving.x,
			snappedMoving.x + snappedMoving.width,
			candidateBoxes,
			movingShapeIds,
			ySnap.candidate.sourceShapeId,
			"x",
		);
		// Indicators on the horizontal guide line (y fixed, x varies)
		const indicators: SnapIndicator[] = [
			...edgeIndicators(position, snappedMoving, "y", ySnap.moving.edge),
			...edgeIndicatorsFromBox(
				position,
				candidateBoxes.get(ySnap.candidate.sourceShapeId),
				"y",
				ySnap.candidate.edge,
			),
		];
		lines.push({
			axis: "y",
			position,
			from: xExtent.min,
			to: xExtent.max,
			movingEdge: ySnap.moving.edge,
			candidateEdge: ySnap.candidate.edge,
			indicators,
		});
	}

	return {
		dx: snapDx,
		dy: snapDy,
		lines,
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

function computeExtent(
	movingMin: number,
	movingMax: number,
	candidateBoxes: ReadonlyMap<string, BoundingBox>,
	_movingShapeIds: ReadonlySet<string>,
	sourceShapeId: string,
	axis: "x" | "y",
): { min: number; max: number } {
	let min = movingMin;
	let max = movingMax;

	const sourceBox = candidateBoxes.get(sourceShapeId);
	if (sourceBox) {
		const sMin = axis === "x" ? sourceBox.x : sourceBox.y;
		const sMax = axis === "x" ? sourceBox.x + sourceBox.width : sourceBox.y + sourceBox.height;
		min = Math.min(min, sMin);
		max = Math.max(max, sMax);
	}

	return { min, max };
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

function edgeIndicatorsFromBox(
	snapPosition: number,
	box: BoundingBox | undefined,
	snapAxis: "x" | "y",
	edge: SnapPoint["edge"],
): SnapIndicator[] {
	if (!box) return [];
	return edgeIndicators(snapPosition, box, snapAxis, edge);
}
