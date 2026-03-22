import type { ShapeData } from "@edv4h/usketch-shared";

/**
 * Downsample points array to maxPoints by evenly spacing.
 */
function downsamplePoints(
	points: Array<{ x: number; y: number }>,
	maxPoints: number,
): Array<{ x: number; y: number }> {
	if (points.length <= maxPoints) return points;
	const step = (points.length - 1) / (maxPoints - 1);
	const result: Array<{ x: number; y: number }> = [];
	for (let i = 0; i < maxPoints; i++) {
		const idx = Math.round(i * step);
		result.push(points[idx]);
	}
	return result;
}

/**
 * Serialize freedraw shapes for handwriting/shape recognition.
 * Downsamples points to keep within token budget.
 */
export function serializeFreedrawForRecognition(shapes: ShapeData[]): string {
	const strokes = shapes
		.filter((s) => s.type === "freedraw" && Array.isArray(s.points))
		.map((s) => {
			const rawPoints = s.points as Array<{ x: number; y: number }>;
			const sampled = downsamplePoints(rawPoints, 80);
			return {
				id: s.id,
				bounds: {
					x: Math.round(s.x),
					y: Math.round(s.y),
					w: Math.round(s.width),
					h: Math.round(s.height),
				},
				pointCount: rawPoints.length,
				points: sampled.map((p) => [Math.round(p.x), Math.round(p.y)]),
			};
		});
	return JSON.stringify({ strokes });
}
