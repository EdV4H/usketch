import type { Point, ShapeData } from "@edv4h/usketch-shared";

/** Freedraw shape extension: intrinsic data for the `freedraw` shape. */
export interface FreedrawShapeData extends ShapeData {
	points: Point[];
}
