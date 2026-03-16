import type { BoundingBox } from "@edv4h/usketch-shared";
import { DEFAULT_SNAP_THRESHOLD } from "../constants.js";
import { extractSnapPoints } from "./snap-points.js";
import type { SnapIndicator, SnapLine, SnapPoint, SnapResult, SnapSettings } from "./types.js";

export function calculateSnap(
	movingBox: BoundingBox,
	movingShapeIds: ReadonlySet<string>,
	candidateBoxes: ReadonlyMap<string, BoundingBox>,
	settings: SnapSettings,
): SnapResult {
	if (!settings.enabled) {
		return { dx: 0, dy: 0, lines: [] };
	}

	const threshold = settings.threshold ?? DEFAULT_SNAP_THRESHOLD;

	// Extract snap points from the moving shape(s)' combined bounding box
	const moving = extractSnapPoints(movingBox, "__moving__", settings);

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
		// Indicators at snap points on the vertical guide line (x fixed, y varies)
		const indicators: SnapIndicator[] = [
			{
				x: position,
				y: edgePos(snappedMoving.y, snappedMoving.height, xSnap.moving.edge),
				edge: xSnap.moving.edge,
			},
			{
				x: position,
				y: edgePosFromBox(
					candidateBoxes.get(xSnap.candidate.sourceShapeId),
					"y",
					xSnap.candidate.edge,
				),
				edge: xSnap.candidate.edge,
			},
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
		// Indicators at snap points on the horizontal guide line (y fixed, x varies)
		const indicators: SnapIndicator[] = [
			{
				x: edgePos(snappedMoving.x, snappedMoving.width, ySnap.moving.edge),
				y: position,
				edge: ySnap.moving.edge,
			},
			{
				x: edgePosFromBox(
					candidateBoxes.get(ySnap.candidate.sourceShapeId),
					"x",
					ySnap.candidate.edge,
				),
				y: position,
				edge: ySnap.candidate.edge,
			},
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
	let bestDist = threshold + 1;

	for (const mp of movingPoints) {
		for (const cp of candidatePoints) {
			const dist = Math.abs(mp.value - cp.value);
			if (dist < bestDist) {
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

function edgePos(origin: number, size: number, edge: SnapPoint["edge"]): number {
	switch (edge) {
		case "min":
			return origin;
		case "center":
			return origin + size / 2;
		case "max":
			return origin + size;
	}
}

function edgePosFromBox(
	box: BoundingBox | undefined,
	axis: "x" | "y",
	edge: SnapPoint["edge"],
): number {
	if (!box) return 0;
	const origin = axis === "x" ? box.x : box.y;
	const size = axis === "x" ? box.width : box.height;
	return edgePos(origin, size, edge);
}
