import type { BoundingBox } from "@edv4h/usketch-shared";
import type { SnapEdge, SnapPoint, SnapSettings } from "./types.js";

export function extractSnapPoints(
	box: BoundingBox,
	shapeId: string,
	settings: Pick<SnapSettings, "edgeSnap" | "centerSnap">,
): { xPoints: SnapPoint[]; yPoints: SnapPoint[] } {
	const xPoints: SnapPoint[] = [];
	const yPoints: SnapPoint[] = [];

	const edges: SnapEdge[] = [];
	if (settings.edgeSnap) edges.push("min", "max");
	if (settings.centerSnap) edges.push("center");

	for (const edge of edges) {
		xPoints.push({
			value: edgeValue(box.x, box.width, edge),
			sourceShapeId: shapeId,
			edge,
		});
		yPoints.push({
			value: edgeValue(box.y, box.height, edge),
			sourceShapeId: shapeId,
			edge,
		});
	}

	return { xPoints, yPoints };
}

function edgeValue(origin: number, size: number, edge: SnapEdge): number {
	switch (edge) {
		case "min":
			return origin;
		case "center":
			return origin + size / 2;
		case "max":
			return origin + size;
	}
}
