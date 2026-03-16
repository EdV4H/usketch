import type { BoundingBox } from "@edv4h/usketch-shared";
import { DEFAULT_SNAP_THRESHOLD } from "../constants.js";
import { extractSnapPoints } from "./snap-points.js";
import type { SnapLine, SnapPoint, SnapResult, SnapSettings } from "./types.js";

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

	// Build guide lines
	const lines: SnapLine[] = [];

	if (xSnap) {
		const position = xSnap.candidate.value;
		// Vertical guide line — compute extent along Y axis
		const yExtent = computeExtent(
			movingBox.y + xSnap.dx,
			movingBox.y + movingBox.height + xSnap.dx,
			candidateBoxes,
			movingShapeIds,
			xSnap.candidate.sourceShapeId,
			"y",
		);
		lines.push({ axis: "x", position, from: yExtent.min, to: yExtent.max });
	}

	if (ySnap) {
		const position = ySnap.candidate.value;
		// Horizontal guide line — compute extent along X axis
		const xExtent = computeExtent(
			movingBox.x + ySnap.dx,
			movingBox.x + movingBox.width + ySnap.dx,
			candidateBoxes,
			movingShapeIds,
			ySnap.candidate.sourceShapeId,
			"x",
		);
		lines.push({ axis: "y", position, from: xExtent.min, to: xExtent.max });
	}

	return {
		dx: xSnap?.dx ?? 0,
		dy: ySnap?.dx ?? 0,
		lines,
	};
}

interface SnapMatch {
	dx: number;
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
				best = { dx: cp.value - mp.value, candidate: cp };
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
