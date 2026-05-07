import type { ShapeData, ShapeRegistry } from "@edv4h/usketch-shared";
import { isRecognitionStroke } from "./contract.js";

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
 * Serialize shapes whose plugin produces stroke payloads for
 * handwriting/shape recognition. Downsamples points to keep within token budget.
 */
export function serializeStrokesForRecognition(
	shapes: ShapeData[],
	registry: ShapeRegistry,
): string {
	const strokes = shapes
		.map((s) => {
			const def = registry.get(s.type);
			const r = def?.serializeForRecognition?.(s);
			if (!isRecognitionStroke(r)) return null;
			const sampled = downsamplePoints(r.points, 80);
			return {
				id: s.id,
				bounds: {
					x: Math.round(s.x),
					y: Math.round(s.y),
					w: Math.round(s.width),
					h: Math.round(s.height),
				},
				pointCount: r.points.length,
				points: sampled.map((p) => [Math.round(p.x), Math.round(p.y)]),
			};
		})
		.filter((s): s is NonNullable<typeof s> => s !== null);
	return JSON.stringify({ strokes });
}
