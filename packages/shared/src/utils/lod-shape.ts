import type { ShapeData } from "../types/shape.js";

/**
 * Lightweight intermediate representation of a shape used by both the LOD
 * (level-of-detail) renderer and the minimap. Reduces a shape to its bounding
 * box and primary fill/stroke so it can be rendered cheaply when full-fidelity
 * rendering is not needed.
 */
export interface LodShape {
	id: string;
	type: string;
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
	stroke?: string;
	zIndex?: string;
}

/** Project a single ShapeData into its LOD representation. */
export function toLodShape(shape: ShapeData): LodShape {
	const style = (shape.style ?? {}) as { fill?: string; stroke?: string };
	return {
		id: shape.id,
		type: shape.type,
		x: shape.x,
		y: shape.y,
		width: shape.width,
		height: shape.height,
		fill: style.fill || "#cccccc",
		stroke: style.stroke,
		zIndex: shape.zIndex,
	};
}

/** Project multiple shapes into their LOD representations. */
export function toLodShapes(shapes: readonly ShapeData[]): LodShape[] {
	return shapes.map(toLodShape);
}
