import type { Point } from "@edv4h/usketch-shared";
import { getArrowDirection } from "./shapes/arrow.js";
import type { ArrowShapeData } from "./types.js";

/** Shape patch while drag-creating a basic shape from `start` to `point`. */
export function getDrawDragPatch(
	subtype: string,
	start: Point,
	point: Point,
): Partial<ArrowShapeData> {
	const patch: Partial<ArrowShapeData> = {
		x: Math.min(start.x, point.x),
		y: Math.min(start.y, point.y),
		width: Math.abs(point.x - start.x),
		height: Math.abs(point.y - start.y),
	};
	if (subtype === "arrow")
		patch.direction = getArrowDirection(point.x - start.x, point.y - start.y);
	return patch;
}
