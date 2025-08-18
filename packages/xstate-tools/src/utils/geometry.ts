// === Geometry Utility Functions ===

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
			return shape as Shape;
		}
	}
	return null;
}

// Check if a point is inside a shape
function isPointInShape(point: Point, shape: any): boolean {
	const { x, y, width, height } = shape;
	return (
		point.x >= x &&
		point.x <= x + width &&
		point.y >= y &&
		point.y <= y + height
	);
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
	const { x, y, width, height } = shape;
	return !(
		x + width < bounds.x ||
		x > bounds.x + bounds.width ||
		y + height < bounds.y ||
		y > bounds.y + bounds.height
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
		width: 100,
		height: 100,
		rotation: 0,
		opacity: 1,
		strokeColor: "#333",
		fillColor: "#fff",
		strokeWidth: 2,
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
