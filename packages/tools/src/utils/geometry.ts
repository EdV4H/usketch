// === Geometry Utility Functions ===

import { DEFAULT_SHAPE_SIZE, DEFAULT_SHAPE_STYLES } from "@usketch/shared-types";
import { whiteboardStore } from "@usketch/store";
import type { Bounds, Point, Shape } from "../types";

// Get shape at a specific point
export function getShapeAtPoint(point: Point): Shape | null {
	const state = whiteboardStore.getState();
	const shapes = Object.values(state.shapes);

	// Check shapes in reverse order (top to bottom)
	for (let i = shapes.length - 1; i >= 0; i--) {
		const shape = shapes[i];
		if (isPointInShape(point, shape)) {
			console.log("Found shape at point:", shape.id, shape.type);
			return shape as Shape;
		}
	}
	console.log("No shape found at point:", point);
	return null;
}

// Check if a point is inside a shape
function isPointInShape(point: Point, shape: any): boolean {
	// Handle different shape types
	if (shape.type === "freedraw") {
		// For freedraw shapes with x, y, width, height (new approach)
		if (
			shape.x !== undefined &&
			shape.y !== undefined &&
			shape.width !== undefined &&
			shape.height !== undefined
		) {
			const padding = 10;
			const isInside =
				point.x >= shape.x - padding &&
				point.x <= shape.x + shape.width + padding &&
				point.y >= shape.y - padding &&
				point.y <= shape.y + shape.height + padding;

			console.log("Checking freedraw shape (with bbox):", {
				shapeX: shape.x,
				shapeY: shape.y,
				width: shape.width,
				height: shape.height,
				point,
				isInside,
			});

			return isInside;
		}
		// Fallback for freedraw shapes with points array (old approach)
		else if (shape.points) {
			const minX = Math.min(...shape.points.map((p: Point) => p.x));
			const minY = Math.min(...shape.points.map((p: Point) => p.y));
			const maxX = Math.max(...shape.points.map((p: Point) => p.x));
			const maxY = Math.max(...shape.points.map((p: Point) => p.y));

			// Add some padding for easier selection
			const padding = 10;
			const isInside =
				point.x >= minX - padding &&
				point.x <= maxX + padding &&
				point.y >= minY - padding &&
				point.y <= maxY + padding;

			console.log("Checking freedraw shape (with points):", {
				minX,
				maxX,
				minY,
				maxY,
				point,
				isInside,
			});

			return isInside;
		}
	}

	// For shapes with width and height (rectangle, ellipse)
	if (shape.width !== undefined && shape.height !== undefined) {
		const { x, y, width, height } = shape;
		return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
	}

	// Default case - use x, y if available
	return false;
}

// Get shapes within bounds
export function getShapesInBounds(bounds: Bounds): Shape[] {
	const state = whiteboardStore.getState();
	const shapes = Object.values(state.shapes);

	return shapes.filter((shape) => {
		return isShapeInBounds(shape, bounds);
	}) as Shape[];
}

// Check if shape intersects with bounds
function isShapeInBounds(shape: any, bounds: Bounds): boolean {
	let shapeX: number, shapeY: number, shapeWidth: number, shapeHeight: number;

	// Handle different shape types
	if (shape.type === "freedraw" && shape.points) {
		// Calculate bounding box for freedraw shapes
		const minX = Math.min(...shape.points.map((p: Point) => p.x));
		const minY = Math.min(...shape.points.map((p: Point) => p.y));
		const maxX = Math.max(...shape.points.map((p: Point) => p.x));
		const maxY = Math.max(...shape.points.map((p: Point) => p.y));

		shapeX = minX;
		shapeY = minY;
		shapeWidth = maxX - minX;
		shapeHeight = maxY - minY;
	} else if (shape.width !== undefined && shape.height !== undefined) {
		// Shapes with explicit width and height
		shapeX = shape.x;
		shapeY = shape.y;
		shapeWidth = shape.width;
		shapeHeight = shape.height;
	} else {
		// Can't determine bounds
		return false;
	}

	return !(
		shapeX + shapeWidth < bounds.x ||
		shapeX > bounds.x + bounds.width ||
		shapeY + shapeHeight < bounds.y ||
		shapeY > bounds.y + bounds.height
	);
}

// Get crop handle at point (not yet implemented)
export function getCropHandleAtPoint(point: Point): any {
	// TODO: Implement actual crop handle detection
	console.log("getCropHandleAtPoint", point);
	return null;
}

// Get shape by ID
export function getShape(id: string): Shape | null {
	const state = whiteboardStore.getState();
	return (state.shapes[id] as Shape) || null;
}

// Update shape properties
export function updateShape(id: string, updates: Partial<Shape>): void {
	const state = whiteboardStore.getState();
	const shape = state.shapes[id];
	if (shape) {
		// Convert to store's Shape type
		state.updateShape(id, updates as any);
	}
}

// Create a new shape
export function createShape(shape: Partial<Shape>): void {
	const fullShape = {
		id: `shape-${Date.now()}`,
		type: "rectangle",
		x: 0,
		y: 0,
		width: DEFAULT_SHAPE_SIZE.width,
		height: DEFAULT_SHAPE_SIZE.height,
		rotation: 0,
		opacity: DEFAULT_SHAPE_STYLES.opacity,
		strokeColor: DEFAULT_SHAPE_STYLES.strokeColor,
		fillColor: DEFAULT_SHAPE_STYLES.fillColor,
		strokeWidth: DEFAULT_SHAPE_STYLES.strokeWidth,
		...shape,
	} as any;

	whiteboardStore.getState().addShape(fullShape);
}

// Commit shape changes (currently a no-op as changes are immediate)
export function commitShapeChanges(): void {
	// Changes are committed immediately in Zustand
	// This could be used for undo/redo in the future
}

export function screenToWorld(point: Point): Point {
	// TODO: Implement actual coordinate transformation
	return point;
}

export function smoothPath(points: Point[], _factor: number): Point[] {
	// TODO: Implement actual path smoothing
	return points;
}
